import { Request, Response } from "express";
import { Multer } from "multer";
import ImageKeeper from "../../image_keeper";
import checkSession from "../check_session";
import { InternalServerErrorResponse } from "../error_response";
import Router from "../router";
import RouteMap, { MethodType } from "../route_map";
import StatusCode from "../status_code";

class UploadRouter extends Router
{
    constructor(upload: Multer)
    {
        super([
            new RouteMap(MethodType.Post, "/image", "uploadImage")
        ]);

        this.registerFunction("uploadImage", this.uploadImage);

        this.useMiddleware(upload.single("image"), [ "/image" ]);
        this.useMiddleware(checkSession, [ "/image" ]);
    }

    async uploadImage(req: Request, res: Response): Promise<any>
    {
        const imageKeeper = new ImageKeeper(req.session["userId"]);
        try
        {
            var imgUrl = await imageKeeper.saveImage(req.file.buffer);
        }
        catch(err)
        {
            console.error(err);
            return this.error(res, new InternalServerErrorResponse());
        }

        if(imgUrl.indexOf("https") === -1)
        {
            imgUrl.replace("http", "https");
        }

        res.status(StatusCode.Created).json({
            imgUrl
        });
    }
}

export default UploadRouter;