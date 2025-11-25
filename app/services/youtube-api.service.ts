import { google, youtube_v3 } from 'googleapis';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { serviceConfigs } from '../../config/global.config';

export class YouTubeAPIService {
  private youtube: youtube_v3.Youtube;

  constructor() {
    // Initialize YouTube Data API v3 client
    // Uses Application Default Credentials (ADC) from Google Cloud
    this.youtube = google.youtube({
      version: 'v3',
      auth: process.env.YOUTUBE_API_KEY // Can use API key for read-only operations
    });
  }

  /**
   * Extract video ID from YouTube URL
   * Supports: youtube.com/watch?v=ID, youtu.be/ID, youtube.com/shorts/ID
   */
  private extractVideoId(url: string): string {
    try {
      const match = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([^&?/]+)/);
      if (!match) {
        throw new Error(`Invalid YouTube URL: ${url}`);
      }
      return match[1];
    } catch (error) {
      throw new Error(`Invalid YouTube URL: ${url}`);
    }
  }

  /**
   * Get video information using YouTube Data API
   */
  async getVideoInfo(url: string): Promise<{
    videoId: string;
    title: string;
    duration: number;
    thumbnail: string;
    hasCaptions: boolean;
  }> {
    try {
      const videoId = this.extractVideoId(url);

      // Fetch video details
      const response = await this.youtube.videos.list({
        part: ['snippet', 'contentDetails'],
        id: [videoId]
      });

      if (!response.data.items || response.data.items.length === 0) {
        throw new Error(`Video not found: ${videoId}`);
      }

      const video = response.data.items[0];
      const snippet = video.snippet!;
      const contentDetails = video.contentDetails!;

      // Parse ISO 8601 duration (e.g., "PT4M13S" -> 253 seconds)
      const duration = this.parseISO8601Duration(contentDetails.duration!);

      // Check video length limit
      if (duration > serviceConfigs.maxVideoLengthSeconds) {
        throw new Error(
          `Video duration (${duration}s) exceeds maximum allowed duration (${serviceConfigs.maxVideoLengthSeconds}s)`
        );
      }

      // Check if captions are available
      const hasCaptions = await this.checkCaptionsAvailable(videoId);

      return {
        videoId,
        title: snippet.title || 'Unknown',
        duration,
        thumbnail: snippet.thumbnails?.high?.url || snippet.thumbnails?.default?.url || '',
        hasCaptions
      };
    } catch (error: any) {
      console.error('Error getting video info from YouTube API:', error.message);
      throw error;
    }
  }

  /**
   * Check if captions/subtitles are available for the video
   */
  private async checkCaptionsAvailable(videoId: string): Promise<boolean> {
    try {
      const response = await this.youtube.captions.list({
        part: ['snippet'],
        videoId: videoId
      });

      return !!(response.data.items && response.data.items.length > 0);
    } catch (error: any) {
      console.warn(`Failed to check captions for ${videoId}:`, error.message);
      return false;
    }
  }

  /**
   * Download captions/subtitles for the video
   * Returns the transcript text or null if captions aren't available
   */
  async downloadCaptions(url: string): Promise<string | null> {
    try {
      const videoId = this.extractVideoId(url);
      console.log(`Attempting to download captions for video: ${videoId}`);

      // Try to fetch captions using the timedtext API (doesn't require OAuth)
      // This is a public endpoint that YouTube uses for embedded players
      const timedtextUrl = `https://www.youtube.com/api/timedtext?v=${videoId}&lang=en&fmt=srv3`;

      console.log(`Fetching captions from timedtext API...`);
      const response = await axios.get(timedtextUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        timeout: 10000
      });

      if (!response.data || response.data.length === 0) {
        console.log('No captions available for this video');
        return null;
      }

      // Parse the XML/JSON caption data
      const captionText = this.parseTimedText(response.data);

      if (!captionText || captionText.trim().length === 0) {
        console.log('Caption parsing resulted in empty text');
        return null;
      }

      console.log(`✓ Successfully downloaded captions (${captionText.length} characters)`);
      return captionText;
    } catch (error: any) {
      console.error('Error downloading captions:', error.message);

      // If quota exceeded or API error, return null to trigger fallback
      if (error.message?.includes('quota') || error.message?.includes('quotaExceeded')) {
        console.warn('YouTube API quota exceeded - will fall back to audio download');
      }

      return null;
    }
  }

  /**
   * Parse YouTube timedtext format (XML) to plain text
   */
  private parseTimedText(data: string): string {
    try {
      // Remove XML tags and extract text content
      // The timedtext format has <text> tags with the caption content
      const textMatches = data.match(/<text[^>]*>([^<]*)<\/text>/g);

      if (!textMatches) {
        return '';
      }

      const textLines: string[] = [];
      for (const match of textMatches) {
        // Extract text between tags and decode HTML entities
        const text = match.replace(/<text[^>]*>([^<]*)<\/text>/, '$1');
        const decoded = this.decodeHTMLEntities(text);
        if (decoded.trim()) {
          textLines.push(decoded.trim());
        }
      }

      return textLines.join(' ');
    } catch (error: any) {
      console.error('Error parsing timedtext:', error.message);
      return '';
    }
  }

  /**
   * Decode HTML entities in caption text
   */
  private decodeHTMLEntities(text: string): string {
    const entities: Record<string, string> = {
      '&amp;': '&',
      '&lt;': '<',
      '&gt;': '>',
      '&quot;': '"',
      '&#39;': "'",
      '&nbsp;': ' '
    };

    let decoded = text;
    for (const [entity, char] of Object.entries(entities)) {
      decoded = decoded.replace(new RegExp(entity, 'g'), char);
    }

    return decoded;
  }

  /**
   * Parse ISO 8601 duration format (e.g., "PT4M13S") to seconds
   */
  private parseISO8601Duration(duration: string): number {
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) {
      return 0;
    }

    const hours = parseInt(match[1] || '0', 10);
    const minutes = parseInt(match[2] || '0', 10);
    const seconds = parseInt(match[3] || '0', 10);

    return hours * 3600 + minutes * 60 + seconds;
  }

  /**
   * Convert SRT format to plain text transcript
   */
  convertSRTToPlainText(srtContent: string): string {
    // Remove timestamp lines and sequence numbers
    const lines = srtContent.split('\n');
    const textLines: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Skip empty lines, sequence numbers, and timestamp lines
      if (line === '' || /^\d+$/.test(line) || /^\d{2}:\d{2}:\d{2}/.test(line)) {
        continue;
      }

      textLines.push(line);
    }

    return textLines.join(' ').trim();
  }
}
