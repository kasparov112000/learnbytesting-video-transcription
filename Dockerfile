#
# MULTISTAGE Dockerfile bug: https://issues.jenkins-ci.org/browse/JENKINS-44609
#


#
# BASE
#
FROM scratch

#
# BUILD
#
FROM node:20-alpine
WORKDIR /var/app

# Install Python 3 and ffmpeg for youtube-dl-exec
RUN apk add --no-cache python3 ffmpeg

ADD package.json .
# ADD .npmrc .
# Skip Python check as we have Python installed
ENV YOUTUBE_DL_SKIP_PYTHON_CHECK=1
RUN npm install
COPY . .
RUN npm run build

#
# UNIT TESTING
#
FROM node:20-alpine

ARG UNIT_TEST=no
WORKDIR /var/app

COPY --from=1 /var/app  /var/app

RUN echo "UNIT_TEST: ${UNIT_TEST}"
RUN if [ "${UNIT_TEST}" = "yes" ]; then \
       echo "**** UNIT TESTING ****"; \
       npm test; \
    fi

#
# RUNTIME
#
FROM node:20-alpine
EXPOSE 3000

ENV ENV_NAME=deployed
ENV DEBUG=mdl:*
ENV npm_package_name=video-transcription
ENV npm_package_version=1.0
ENV PROFILER=false
ENV PROFILER_SERVICE_NAME=video-transcription
ENV PROFILER_SERVICE_URL=http://smtp-ms.egg-smtp.svc.cluster.local
ENV ENV_NAME=${ENV_NAME}

# Install FFmpeg and Python 3.11 for youtube-dl-exec (yt-dlp requires Python 3.10+)
RUN apk add --no-cache \
    ffmpeg \
    python3 \
    py3-pip

# RUN addgroup pwcapp \
#     && adduser --home /var/app --ingroup pwcapp --gecos 'PwC' --disabled-password pwcapp

WORKDIR /var/app

COPY --from=1 /var/app/package.json .
# COPY --from=1 /var/app/.npmrc .
COPY --from=1 /var/app/dist .
# COPY --from=1 /var/app/docs ./docs/

# RUN chown -R pwcapp:pwcapp /var/app

# USER pwcapp
RUN npm install --production



ENTRYPOINT ["node", "./app/index.js"]
