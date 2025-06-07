import { getStorage } from "firebase-admin/storage";
import fetch from "node-fetch";

/**
 * Downloads an image from `imageUrl` and uploads it to Firebase Storage at `destPath`.
 * Returns the public URL (or an empty string if the process fails).
 */
export async function downloadAndUploadImage(
    imageUrl: string,
    destPath: string
): Promise<string> {
    if (!imageUrl) return "";

    try {
        // 1) Download the image
        const response = await fetch(imageUrl);
        if (!response.ok) {
            console.error(
                `Failed to download image from ${imageUrl} — status: ${response.status}`
            );
            return "";
        }
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // 2) Upload it to Firebase Storage
        const bucket = getStorage().bucket(process.env.NEXT_PUBLIC_FIREBASE_storageBucket); // uses default bucket from Firebase config
        
        // Fix for duplicate .appspot.com suffix issue
        let bucketName = bucket.name;
        if (bucketName.endsWith('.appspot.com.appspot.com')) {
            bucketName = bucketName.replace('.appspot.com.appspot.com', '.appspot.com');
            console.log("Fixed duplicate suffix in bucket name to:", bucketName);
        }
        
        console.log("Using storage bucket:", bucketName);
        const file = bucket.file(destPath);

        await file.save(buffer, {
            contentType: "image/jpeg",
            // If you know the actual MIME type, set it accordingly.
            // You could also inspect response.headers.get("content-type")
        });

        // 3) Make it publicly readable. If you need a signed URL or
        //    have custom security rules, adjust accordingly.
        await file.makePublic();

        // 4) Return the public download URL
        const publicUrl = `https://storage.googleapis.com/${bucketName}/${file.name}`;
        return publicUrl;
    } catch (err) {
        console.error("Error in downloadAndUploadImage:", err);
        return "";
    }
}
