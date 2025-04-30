export class Settings {
  static NAMESPACE = "s3-music-player";

  static registerSettings() {
    // Register module settings
    game.settings.register(this.NAMESPACE, "s3AccessKey", {
      name: "S3 Access Key",
      hint: "Your AWS S3 access key",
      scope: "world",
      config: true,
      type: String,
      default: "",
      restricted: true,
    });

    game.settings.register(this.NAMESPACE, "s3SecretKey", {
      name: "S3 Secret Key",
      hint: "Your AWS S3 secret key",
      scope: "world",
      config: true,
      type: String,
      default: "",
      restricted: true,
    });

    game.settings.register(this.NAMESPACE, "s3BucketName", {
      name: "S3 Bucket Name",
      hint: "The name of your S3 bucket containing music files",
      scope: "world",
      config: true,
      type: String,
      default: "",
      restricted: true,
    });

    game.settings.register(this.NAMESPACE, "s3Region", {
      name: "S3 Region",
      hint: "The AWS region of your S3 bucket (e.g., us-east-1)",
      scope: "world",
      config: true,
      type: String,
      default: "us-east-1",
      restricted: true,
    });
  }

  static getSetting(key) {
    return game.settings.get(this.NAMESPACE, key);
  }
}
