import { v2 as cloudinary } from 'cloudinary'
import fs from "fs"

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.eventNames.CLOUDINARY_API_SECRET
});

const uploadOnCloudinary = async function (localFilePath) {
    try {
        if (!localFilePath) return null;
        const response = await cloudinary.uploader.upload(localFilePath, {
            resource_type: "auto"
        })
        // if file successfully got uploaded
        console.log("File Successfully Uploaded on Cloud ", response.url);
        return response
    } catch (error) {
        fs.unlinkSync(localFilePath);
        // removes the locally saved file as the upload got failed
    }
}

export { uploadOnCloudinary }