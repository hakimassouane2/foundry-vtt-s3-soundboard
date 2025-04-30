import { S3MusicBrowser } from "./components/s3-music-browser.js";
import { Settings } from "./settings.js";

Hooks.once("init", async function () {
  console.log("S3 Music Player | Initializing");

  // Register module settings
  Settings.registerSettings();
});

Hooks.once("ready", async function () {
  console.log("S3 Music Player | Ready");

  // Add the S3 music tab to playlists directory
  if (game.user.isGM) {
    // Create button in playlist directory
    const playlistDirectory = game.playlists.apps[0];
    const originalPlaylistHeader = playlistDirectory._getHeaderButtons;

    playlistDirectory._getHeaderButtons = function () {
      let buttons = originalPlaylistHeader.call(this);
      buttons.unshift({
        label: "S3 Music",
        class: "s3-music-browser",
        icon: "fas fa-cloud",
        onclick: () => new S3MusicBrowser().render(true),
      });
      return buttons;
    };

    // Refresh the directory to show the new button
    playlistDirectory.render(true);
  }
});
