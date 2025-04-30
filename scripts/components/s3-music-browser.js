export class S3MusicBrowser extends Application {
  constructor(options = {}) {
    super(options);
    this.s3Client = new S3Client();
    this.currentPath = "";
    this.files = [];
    this.breadcrumbs = [{ name: "Home", path: "" }];
  }

  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      id: "s3-music-browser",
      template: "modules/s3-music-player/templates/s3-music-browser.html",
      title: "S3 Music Browser",
      width: 720,
      height: 800,
      resizable: true,
      classes: ["s3-music-browser"],
    });
  }

  async getData() {
    // Load files from current path
    this.files = await this.s3Client.listFiles(this.currentPath);

    return {
      files: this.files,
      breadcrumbs: this.breadcrumbs,
      currentPath: this.currentPath,
    };
  }

  activateListeners(html) {
    super.activateListeners(html);

    // Folder navigation
    html.find(".folder-item").click((ev) => {
      const path = ev.currentTarget.dataset.path;
      const name = ev.currentTarget.dataset.name;
      this.navigateToFolder(path, name);
    });

    // Breadcrumb navigation
    html.find(".breadcrumb-item").click((ev) => {
      const path = ev.currentTarget.dataset.path;
      const index = parseInt(ev.currentTarget.dataset.index);
      this.navigateToBreadcrumb(path, index);
    });

    // Play audio file
    html.find(".file-item").click((ev) => {
      const path = ev.currentTarget.dataset.path;
      const name = ev.currentTarget.dataset.name;
      this.playAudio(path, name);
    });

    // Add to playlist
    html.find(".add-to-playlist").click(async (ev) => {
      ev.stopPropagation();
      const path = ev.currentTarget.dataset.path;
      const name = ev.currentTarget.dataset.name;
      await this.addToPlaylist(path, name);
    });

    // Create playlist from folder
    html.find(".create-playlist-btn").click(async (ev) => {
      await this.createPlaylistFromFolder();
    });

    // Search
    html.find("#s3-search").on("input", (ev) => {
      const searchTerm = ev.target.value.toLowerCase();
      this.filterFiles(searchTerm);
    });
  }

  navigateToFolder(path, name) {
    this.currentPath = path;

    // Update breadcrumbs
    this.breadcrumbs = this.breadcrumbs.filter((crumb, index) => {
      return index < this.breadcrumbs.findIndex((c) => c.path === path) + 1;
    });

    if (this.breadcrumbs.findIndex((c) => c.path === path) === -1) {
      this.breadcrumbs.push({ name, path });
    }

    this.render(true);
  }

  navigateToBreadcrumb(path, index) {
    this.currentPath = path;
    this.breadcrumbs = this.breadcrumbs.slice(0, index + 1);
    this.render(true);
  }

  filterFiles(searchTerm) {
    const fileItems = this.element.find(".file-list-item");

    fileItems.each((i, item) => {
      const name = item.dataset.name.toLowerCase();
      if (name.includes(searchTerm)) {
        item.style.display = "";
      } else {
        item.style.display = "none";
      }
    });
  }

  async playAudio(path, name) {
    const url = this.s3Client.getFileUrl(path);

    if (!url) {
      ui.notifications.error("Failed to generate audio URL.");
      return;
    }

    // Create a temporary soundtrack in the current scene
    const scene = game.scenes.current;
    if (!scene) {
      ui.notifications.warn("No active scene to play audio in.");
      return;
    }

    // Stop any currently playing tracks
    for (let sound of game.audio.playing) {
      if (sound.src.includes("s3-temp-track")) {
        sound.stop();
      }
    }

    // Play the audio
    AudioHelper.play(
      {
        src: url,
        volume: 0.5,
        loop: false,
      },
      true
    );

    ui.notifications.info(`Playing: ${name}`);
  }

  async addToPlaylist(path, name) {
    const url = this.s3Client.getFileUrl(path);

    if (!url) {
      ui.notifications.error("Failed to generate audio URL.");
      return;
    }

    // Get target playlist
    const playlists = game.playlists.contents.map((p) => ({
      id: p.id,
      name: p.name,
    }));

    const dialogContent = `
      <form>
        <div class="form-group">
          <label>Choose Playlist:</label>
          <select id="playlist-select" name="playlistId">
            ${playlists
              .map((p) => `<option value="${p.id}">${p.name}</option>`)
              .join("")}
            <option value="new">Create New Playlist</option>
          </select>
        </div>
        <div class="form-group" id="new-playlist-group" style="display: none;">
          <label>New Playlist Name:</label>
          <input type="text" name="newPlaylistName" value="${
            name.split(".")[0]
          }">
        </div>
      </form>
      <script>
        $('#playlist-select').change(function() {
          if ($(this).val() === 'new') {
            $('#new-playlist-group').show();
          } else {
            $('#new-playlist-group').hide();
          }
        });
      </script>
    `;

    // Show dialog to choose playlist
    const dialog = new Dialog({
      title: "Add to Playlist",
      content: dialogContent,
      buttons: {
        submit: {
          label: "Add",
          callback: async (html) => {
            const formData = new FormDataExtended(html.find("form")[0]);
            const data = formData.object;

            let playlist;
            if (data.playlistId === "new") {
              playlist = await Playlist.create({
                name: data.newPlaylistName || name.split(".")[0],
                sounds: [],
              });
            } else {
              playlist = game.playlists.get(data.playlistId);
            }

            // Create sound in playlist
            await playlist.createSound({
              name: name.split(".")[0],
              path: url,
              volume: 0.5,
            });

            ui.notifications.info(
              `Added "${name}" to playlist "${playlist.name}"`
            );
          },
        },
        cancel: {
          label: "Cancel",
        },
      },
      default: "submit",
    });

    dialog.render(true);
  }

  async createPlaylistFromFolder() {
    if (!this.currentPath) {
      ui.notifications.warn("Please navigate to a folder first.");
      return;
    }

    // Get all audio files in the current folder
    const files = await this.s3Client.listFiles(this.currentPath);
    const audioFiles = files.filter((f) => f.type === "file");

    if (audioFiles.length === 0) {
      ui.notifications.warn("No audio files found in this folder.");
      return;
    }

    // Create playlist name from folder name
    const folderName = this.breadcrumbs[this.breadcrumbs.length - 1].name;

    // Create dialog to confirm
    const dialog = new Dialog({
      title: "Create Playlist from Folder",
      content: `
        <form>
          <div class="form-group">
            <label>Playlist Name:</label>
            <input type="text" name="playlistName" value="${folderName}" required>
          </div>
          <p>This will create a new playlist with ${audioFiles.length} tracks from the current folder.</p>
        </form>
      `,
      buttons: {
        create: {
          label: "Create",
          callback: async (html) => {
            const formData = new FormDataExtended(html.find("form")[0]);
            const data = formData.object;

            // Create new playlist
            const playlist = await Playlist.create({
              name: data.playlistName,
              sounds: [],
            });

            // Add all audio files as sounds
            let addedCount = 0;
            for (const file of audioFiles) {
              const url = this.s3Client.getFileUrl(file.path);
              if (url) {
                await playlist.createSound({
                  name: file.name.split(".")[0],
                  path: url,
                  volume: 0.5,
                });
                addedCount++;
              }
            }

            ui.notifications.info(
              `Created playlist "${playlist.name}" with ${addedCount} tracks.`
            );
          },
        },
        cancel: {
          label: "Cancel",
        },
      },
      default: "create",
    });

    dialog.render(true);
  }
}
