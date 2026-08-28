import { useEffect, useRef, useState } from "react";

let youtubeApiPromise = null;

function loadYouTubeAPI() {
  if (youtubeApiPromise) {
    return youtubeApiPromise;
  }

  youtubeApiPromise = new Promise((resolve) => {
    if (window.YT && window.YT.Player) {
      resolve(window.YT);
      return;
    }

    window.onYouTubeIframeAPIReady = () => {
      resolve(window.YT);
    };

    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.body.appendChild(tag);
  });

  return youtubeApiPromise;
}

function YouTubePlayer({ videoId, playState, currentTime, containerId }) {
  const playerRef = useRef(null);
  const [isReady, setIsReady] = useState(false);
  const initialTimeRef = useRef(currentTime);

  useEffect(() => {
    let cancelled = false;

    loadYouTubeAPI().then((YT) => {
      if (cancelled) return;

      playerRef.current = new YT.Player(containerId, {
        height: "100%",
        width: "100%",
        videoId: videoId || undefined,
        playerVars: {
          controls: 0,
          disablekb: 1,
          modestbranding: 1,
          rel: 0,
          start: Math.floor(initialTimeRef.current || 0),
        },
        events: {
          onReady: () => setIsReady(true),
        },
      });
    });

    return () => {
      cancelled = true;
      if (playerRef.current && playerRef.current.destroy) {
        playerRef.current.destroy();
      }
    };
  }, []);

  useEffect(() => {
    if (!isReady || !playerRef.current || !videoId) return;
    playerRef.current.cueVideoById(videoId, currentTime || 0);
  }, [isReady, videoId]);

  useEffect(() => {
    if (!isReady || !playerRef.current) return;

    if (playState === "playing") {
      playerRef.current.playVideo();
    } else {
      playerRef.current.pauseVideo();
    }
  }, [isReady, playState]);

  useEffect(() => {
    if (!isReady || !playerRef.current) return;

    const playerTime = playerRef.current.getCurrentTime ? playerRef.current.getCurrentTime() : 0;

    if (Math.abs(playerTime - currentTime) > 1.5) {
      playerRef.current.seekTo(currentTime, true);
    }
  }, [isReady, currentTime]);

  YouTubePlayer.getLiveTime = () => {
    if (playerRef.current && playerRef.current.getCurrentTime) {
      return playerRef.current.getCurrentTime();
    }
    return 0;
  };

  return <div id={containerId}></div>;
}

export default YouTubePlayer;
