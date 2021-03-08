function updateMediaAudioSettings(mediaVideo, settings, globalRolloffFactor) {
  mediaVideo.el.setAttribute("media-video", {
    distanceModel: settings.mediaDistanceModel,
    rolloffFactor: settings.mediaRolloffFactor * globalRolloffFactor,
    refDistance: settings.mediaRefDistance,
    maxDistance: settings.mediaMaxDistance,
    coneInnerAngle: settings.mediaConeInnerAngle,
    coneOuterAngle: settings.mediaConeOuterAngle,
    coneOuterGain: settings.mediaConeOuterGain
  });
}

function updateAvatarAudioSettings(avatarAudioSource, settings, positional, globalRolloffFactor) {
  avatarAudioSource.el.setAttribute("avatar-audio-source", {
    positional,
    distanceModel: settings.avatarDistanceModel,
    maxDistance: settings.avatarMaxDistance,
    refDistance: settings.avatarRefDistance,
    rolloffFactor: settings.avatarRolloffFactor * globalRolloffFactor
  });
}

export class AudioSettingsSystem {
  constructor(sceneEl) {
    this.sceneEl = sceneEl;
    this.defaultSettings = {
      avatarDistanceModel: "inverse",
      avatarRolloffFactor: 2,
      avatarRefDistance: 1,
      avatarMaxDistance: 10000,
      mediaVolume: 0.5,
      mediaDistanceModel: "inverse",
      mediaRolloffFactor: 1,
      mediaRefDistance: 1,
      mediaMaxDistance: 10000,
      mediaConeInnerAngle: 360,
      mediaConeOuterAngle: 0,
      mediaConeOuterGain: 0
    };
    this.audioSettings = this.defaultSettings;
    this.mediaVideos = [];
    this.avatarAudioSources = [];

    this.sceneEl.addEventListener("reset_scene", this.onSceneReset);

    // DB - todo - find out the utility of this? Why should one hard wire positional audio back to audio?
    if (window.APP.store.state.preferences.audioOutputMode === "audio") {
      //hack to always reset to "panner"
      window.APP.store.update({
        preferences: { audioOutputMode: "panner" }
      });
    }
    console.log("DB: preferences.globalRolloffFactor: " + window.APP.store.state.preferences.globalRolloffFactor);
    if (window.APP.store.state.preferences.globalRolloffFactor !== 1.0) {
      console.log("DB: Current globalRolloffFactor is: " + window.APP.store.state.preferences.globalRolloffFactor);
      //hack to always reset to 1.0
      window.APP.store.update({
        preferences: { globalRolloffFactor: 1.0 }
      });
    }
    
    if (window.APP.store.state.preferences.audioNormalization !== 0.0) {
      //hack to always reset to 0.0 (disabled)
      window.APP.store.update({
        preferences: { audioNormalization: 0.0 }
      });
    }

    this.audioOutputMode = window.APP.store.state.preferences.audioOutputMode;
    this.globalRolloffFactor = window.APP.store.state.preferences.globalRolloffFactor; //added
    this.globalDistanceModel = window.APP.store.state.preferences.globalDistanceModel; //added
    this.onPreferenceChanged = () => {
      const { audioOutputMode, globalRolloffFactor, globalDistanceModel } = window.APP.store.state.preferences;
      
      const shouldUpdateAudioSettings =
        this.audioOutputMode !== audioOutputMode || this.globalRolloffFactor !== globalRolloffFactor || this.globalDistanceModel !== this.globalDistanceModel;
      console.log(
        "this.globalRolloffFactor !== globalRolloffFactor: " + this.globalRolloffFactor !== globalRolloffFactor
      );
      console.log("shouldUpdateAudioSettings "+shouldUpdateAudioSettings);
      this.audioOutputMode = audioOutputMode;
      this.globalRolloffFactor = globalRolloffFactor;
      this.globalDistanceModel = globalDistanceModel;
      this.audioSettings.avatarDistanceModel = globalDistanceModel;
      console.log("avatarDistanceModel:"+this.audioSettings.avatarDistanceModel);
      this.audioSettings.mediaDistanceModel = globalDistanceModel;
      console.log("mediaDistanceModel:"+this.audioSettings.mediaDistanceModel);
      console.log("gain:"+document.getElementsByTagName("a-scene")[0].audioListener.gain.gain.value);
      console.log("gain:"+document.getElementsByTagName("a-scene")[0].avatarAudioSource);
      if (shouldUpdateAudioSettings) {
        this.updateAudioSettings(this.audioSettings);
      }
    };
    window.APP.store.addEventListener("statechanged", this.onPreferenceChanged);
  }

  registerMediaAudioSource(mediaVideo) {
    const index = this.mediaVideos.indexOf(mediaVideo);
    if (index === -1) {
      this.mediaVideos.push(mediaVideo);
    }
    updateMediaAudioSettings(mediaVideo, this.audioSettings, this.globalRolloffFactor);
  }

  unregisterMediaAudioSource(mediaVideo) {
    this.mediaVideos.splice(this.mediaVideos.indexOf(mediaVideo), 1);
  }

  registerAvatarAudioSource(avatarAudioSource) {
    const index = this.avatarAudioSources.indexOf(avatarAudioSource);
    if (index === -1) {
      this.avatarAudioSources.push(avatarAudioSource);
    }
    const positional = window.APP.store.state.preferences.audioOutputMode !== "audio";
    updateAvatarAudioSettings(avatarAudioSource, this.audioSettings, positional, this.globalRolloffFactor);
  }

  unregisterAvatarAudioSource(avatarAudioSource) {
    const index = this.avatarAudioSources.indexOf(avatarAudioSource);
    if (index !== -1) {
      this.avatarAudioSources.splice(index, 1);
    }
  }

  updateAudioSettings(settings) {
    this.audioSettings = Object.assign({}, this.defaultSettings, settings);

    for (const mediaVideo of this.mediaVideos) {
      updateMediaAudioSettings(mediaVideo, settings, this.globalRolloffFactor);
    }

    const positional = window.APP.store.state.preferences.audioOutputMode !== "audio";
    for (const avatarAudioSource of this.avatarAudioSources) {
      updateAvatarAudioSettings(avatarAudioSource, settings, positional, this.globalRolloffFactor);
    }
  }
  
  toLog() {
    return JSON.stringify(this.audioSettings,null,2);
  }


  onSceneReset = () => {
    this.updateAudioSettings(this.defaultSettings);
  };
}

AFRAME.registerComponent("use-audio-system-settings", {
  init() {
    this.onVideoLoaded = this.onVideoLoaded.bind(this);
    this.el.addEventListener("video-loaded", this.onVideoLoaded);
  },

  onVideoLoaded() {
    const audioSettingsSystem = this.el.sceneEl.systems["hubs-systems"].audioSettingsSystem;
    if (this.mediaVideo) {
      audioSettingsSystem.unregisterMediaAudioSource(this.mediaVideo);
    }
    this.mediaVideo = this.el.components["media-video"];
    audioSettingsSystem.registerMediaAudioSource(this.mediaVideo);
  },

  remove() {
    const audioSettingsSystem = this.el.sceneEl.systems["hubs-systems"].audioSettingsSystem;
    if (this.mediaVideo) {
      audioSettingsSystem.unregisterMediaAudioSource(this.mediaVideo);
    }
    this.el.removeEventListener("video-loaded", this.onVideoLoaded);
  }
});
