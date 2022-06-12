import { v2 as cloudinary } from "cloudinary";
import sharp from "sharp";
import streamifier from "streamifier";
import randomWord from "./random_word";

class ImageKeeper
{
    private imageFolder: string;

    constructor(userId: number)
    {
        this.imageFolder = `uploads/${userId}`;
    }

    async saveImage(img: any): Promise<string>
    {
        try
        {
            var buffer = await sharp(img).jpeg().toBuffer();
        }
        catch(err)
        {
            throw err;
        }
        
        return await this.uploadBuffer(buffer);
    }
    
    async saveProfilePicture(img: any): Promise<string>
    {
        try
        {
            var buffer = await sharp(img).jpeg().resize(500, 500, { position: "center", fit: "cover" }).toBuffer();
        }
        catch(err)
        {
            throw err;
        }

        return await this.uploadBuffer(buffer);
    }

    async saveBanner(img: any): Promise<string>
    {
        try
        {
            var buffer = await sharp(img).jpeg().resize(1500, 500, { position: "center", fit: "cover" }).toBuffer();
        }
        catch(err)
        {
            throw err;
        }

        return await this.uploadBuffer(buffer);
    }

    private async uploadBuffer(buffer: any): Promise<string>
    {
        let filename = `${randomWord(8)}.jpg`;
        let path = `${this.imageFolder}/${filename}`;

        return await this.uploadImage(buffer, path);
    }

    private uploadImage(buffer: any, id: string): Promise<string>
    {
        return new Promise((resolve, reject) => {
            let stream = cloudinary.uploader.upload_stream({ public_id: id }, (err, result) => {
                if(err)
                {
                    reject(err);
                }
                else
                {
                    resolve(result.url);
                }
            });

            streamifier.createReadStream(buffer).pipe(stream);
        });
    }
}

export default ImageKeeper;