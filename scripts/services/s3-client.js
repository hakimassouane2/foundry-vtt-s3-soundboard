export class S3Client {
  constructor() {
    this.accessKey = Settings.getSetting("s3AccessKey");
    this.secretKey = Settings.getSetting("s3SecretKey");
    this.bucketName = Settings.getSetting("s3BucketName");
    this.region = Settings.getSetting("s3Region");

    // Import AWS SDK via dynamic import (to be loaded at runtime)
    this.awsLoaded = false;
    this.loadAwsSdk();
  }

  async loadAwsSdk() {
    // Load AWS SDK from CDN
    if (!window.AWS) {
      await new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "https://sdk.amazonaws.com/js/aws-sdk-2.1049.0.min.js";
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
    }

    // Configure AWS
    AWS.config.update({
      accessKeyId: this.accessKey,
      secretAccessKey: this.secretKey,
      region: this.region,
    });

    this.s3 = new AWS.S3();
    this.awsLoaded = true;
    console.log("S3 Music Player | AWS SDK loaded");
  }

  async listFiles(prefix = "") {
    if (!this.awsLoaded) await this.loadAwsSdk();

    try {
      const params = {
        Bucket: this.bucketName,
        Prefix: prefix,
        Delimiter: "/",
      };

      const data = await this.s3.listObjectsV2(params).promise();

      // Process folders (CommonPrefixes)
      const folders = data.CommonPrefixes
        ? data.CommonPrefixes.map((prefix) => {
            return {
              name: prefix.Prefix.split("/").slice(-2)[0],
              path: prefix.Prefix,
              type: "folder",
            };
          })
        : [];

      // Process files
      const files = data.Contents
        ? data.Contents.filter(
            (item) => !item.Key.endsWith("/") && item.Key !== prefix
          ) // Filter out folders and current prefix
            .map((item) => {
              const fileName = item.Key.split("/").pop();
              return {
                name: fileName,
                path: item.Key,
                size: item.Size,
                lastModified: item.LastModified,
                type: "file",
                extension: fileName.split(".").pop().toLowerCase(),
              };
            })
            .filter((file) =>
              ["mp3", "ogg", "wav", "flac", "m4a"].includes(file.extension)
            )
        : [];

      return [...folders, ...files];
    } catch (error) {
      console.error("S3 Music Player | Error listing files:", error);
      ui.notifications.error(
        `S3 Music Player: Failed to list files - ${error.message}`
      );
      return [];
    }
  }

  getFileUrl(key) {
    if (!this.awsLoaded) {
      console.error("S3 Music Player | AWS SDK not loaded");
      return null;
    }

    const params = {
      Bucket: this.bucketName,
      Key: key,
      Expires: 3600, // URL valid for 1 hour
    };

    try {
      return this.s3.getSignedUrl("getObject", params);
    } catch (error) {
      console.error("S3 Music Player | Error generating signed URL:", error);
      return null;
    }
  }
}
