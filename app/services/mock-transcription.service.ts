/**
 * Mock Transcription Service
 * Use this for development/testing to avoid API charges
 */

export class MockTranscriptionService {
  /**
   * Generate a realistic mock transcript based on video duration
   */
  async transcribe(audioFilePath: string, language: string): Promise<string> {
    console.log('🎭 MOCK: Using mock transcription (no API charges)');
    console.log(`   Audio file: ${audioFilePath}`);
    console.log(`   Language: ${language}`);

    // Simulate processing time (1-3 seconds)
    const delay = 1000 + Math.random() * 2000;
    await new Promise(resolve => setTimeout(resolve, delay));

    // Generate mock transcript
    const mockTranscripts = [
      this.generateChessTranscript(),
      this.generateEducationalTranscript(),
      this.generateTutorialTranscript(),
      this.generateLectureTranscript()
    ];

    // Return a random mock transcript
    const transcript = mockTranscripts[Math.floor(Math.random() * mockTranscripts.length)];

    console.log(`✓ MOCK: Generated ${transcript.length} characters`);
    return transcript;
  }

  /**
   * Generate a chess-related transcript
   */
  private generateChessTranscript(): string {
    return `Welcome to this chess tutorial. Today we're going to explore one of the most powerful opening strategies that can help you dominate your opponents.

The key to this opening is understanding the fundamental principles of controlling the center. When you start with pawn to d4, you immediately stake your claim in the center of the board. This move is the foundation of many strong opening systems.

Let me show you the main variations. After d4, your opponent will typically respond with knight to f6 or pawn to d5. Both of these moves are perfectly sound, but we need to be prepared for either response.

If they play knight to f6, we continue with c4, which is the Queen's Gambit. This move offers a pawn sacrifice to gain control of the center. Now, many beginners worry about losing material, but this is actually a very small price to pay for the initiative.

The important thing to remember is that chess is not just about material. It's about piece activity, king safety, and controlling key squares. When you understand these concepts, your game will improve dramatically.

Let's look at some example games from grandmaster play. In this position, white has a clear advantage because of better piece coordination. The knight on c3 is perfectly placed, supporting the center and ready to jump to either d5 or e4.

One critical mistake that players under 2000 make is moving the same piece multiple times in the opening. Every move should serve a purpose - either developing a piece, controlling the center, or improving king safety.

Now, when you reach the middle game, the strategy changes slightly. You need to look for tactical opportunities while maintaining your positional advantages. This is where calculation becomes crucial.

Remember, the key to improving at chess is consistent practice and studying master games. Try to understand the ideas behind each move, not just memorize variations. This will make you a much stronger player in the long run.

Thank you for watching this tutorial. If you found this helpful, please like and subscribe for more chess content. I'll see you in the next video where we'll explore another powerful opening system.`;
  }

  /**
   * Generate an educational transcript
   */
  private generateEducationalTranscript(): string {
    return `Hello and welcome to today's lesson. In this video, we're going to dive deep into a fascinating topic that many people find challenging at first, but once you understand the core concepts, everything becomes much clearer.

The first thing you need to know is the fundamental principle behind this subject. It's actually quite simple when you break it down into smaller pieces. Let me explain step by step.

Step one is understanding the basic terminology. Without a solid grasp of these key terms, the more advanced concepts won't make sense. So let's start with the definitions.

Now that we've covered the basics, let's move on to some practical applications. This is where the theory really comes to life and you can see how useful this knowledge is in real-world situations.

One common mistake that beginners make is trying to rush through the material without truly understanding each concept. Take your time with this. It's better to master one thing completely than to have a superficial understanding of many things.

Let's look at an example to illustrate this point. In this scenario, you can see how the principles we discussed earlier apply directly. Notice how each element connects to the others - nothing exists in isolation.

The key takeaway here is that practice makes perfect. Don't get discouraged if you don't understand everything immediately. Even experts had to start somewhere, and they made plenty of mistakes along the way.

As we wrap up today's lesson, I want to emphasize the importance of reviewing this material regularly. Come back to this video in a few days and watch it again - you'll be surprised how much more sense it makes the second time around.

Thank you for your attention today. If you have any questions, please leave them in the comments below. I read every comment and try to respond to as many as possible. See you in the next lesson!`;
  }

  /**
   * Generate a tutorial transcript
   */
  private generateTutorialTranscript(): string {
    return `Hey everyone, welcome back to the channel. Today we're going to build something really cool that I think you're going to love. So let's jump right in.

First, let me show you what we're going to create. As you can see, this is a fully functional application with all the features you'd expect. It looks great, it works smoothly, and best of all, it's not that complicated to build.

Before we start coding, let's talk about the tools we're going to use. You'll need to have these installed on your system, but don't worry if you don't have them yet - I'll show you exactly where to get them and how to set everything up.

Alright, now that we have everything ready, let's create our project structure. I like to organize things in a way that makes sense and is easy to maintain. Good project structure is crucial for any successful application.

Let's start by creating the main file. I'm going to type this out slowly so you can follow along. If you need to pause the video at any point, feel free to do so. There's no rush.

Now we're going to add the core functionality. This is where the magic happens. Pay close attention to this part because it's really important. If you get this wrong, nothing else will work properly.

One thing I want to point out here is this particular line of code. A lot of beginners get confused by this, but it's actually quite straightforward once you understand what's happening. Let me explain.

Okay, so now we have the basic structure in place. Let's test it to make sure everything is working correctly. Testing as you go is a good habit to develop - it helps you catch errors early before they become bigger problems.

Perfect! It's working exactly as expected. Now let's add some additional features to make this even better. These are optional, but I highly recommend including them because they really enhance the user experience.

And there we have it! We've successfully built a complete application from scratch. I hope you found this tutorial helpful and learned something new today. If you did, please hit that like button and subscribe for more content like this. Thanks for watching!`;
  }

  /**
   * Generate a lecture transcript
   */
  private generateLectureTranscript(): string {
    return `Good morning everyone. Today we're going to explore a topic that has fascinated scholars and practitioners for centuries. This is one of those subjects that seems simple on the surface, but reveals incredible depth the more you study it.

Let's begin with some historical context. The origins of this field can be traced back to ancient civilizations, where early thinkers first began to formalize these ideas. Their insights laid the groundwork for everything that came after.

As we move through history, we see how these concepts evolved and were refined by successive generations of scholars. Each era contributed something unique, building upon the work of those who came before.

Now, in the modern era, we have a much more sophisticated understanding of these principles. Advanced technology and research methods have allowed us to verify many of the intuitions that earlier thinkers had, while also discovering entirely new dimensions to the field.

Let me present three key theories that are central to our understanding. The first theory suggests that the fundamental mechanism operates through a series of interconnected processes. The second theory proposes an alternative framework that emphasizes different factors. And the third theory attempts to synthesize elements from both approaches.

Each of these theories has its strengths and weaknesses. As critical thinkers, our job is not to blindly accept any single perspective, but to evaluate the evidence carefully and draw informed conclusions.

Let's examine some empirical data that relates to these theories. As you can see from these studies, the evidence is somewhat mixed. Some findings support one theory, while other findings seem to contradict it. This is actually quite normal in scientific research.

The important lesson here is that knowledge is provisional and always subject to revision in light of new evidence. What we think we know today may be refined or even overturned tomorrow. This is not a weakness of science - it's actually one of its greatest strengths.

As we conclude today's lecture, I want you to think critically about what we've discussed. Don't just memorize the material - engage with it. Ask questions. Challenge assumptions. That's how real learning happens.

For your assignment this week, I'd like you to write a short essay exploring one of the theories we discussed today in greater depth. Be sure to cite your sources properly and present a well-reasoned argument. I'm looking forward to reading your responses.

That's all for today. Thank you for your attention, and I'll see you next week.`;
  }
}
