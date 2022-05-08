import { Request, Response } from "express";
import { CheepsDocument } from "../../sparrow_model/cheeps";
import { UserShortInformation } from "../../sparrow_model/users";
import checkSession from "../check_session";
import { InternalServerErrorResponse, InvalidCheepContentResponse } from "../error_response";
import Router from "../router";
import RouteMap, { MethodType } from "../route_map";
import StatusCode from "../status_code";

class CheepsRouter extends Router
{
    constructor()
    {
        super([
            new RouteMap(MethodType.Post, "/create", "createCheep")
        ]);

        this.registerFunction("createCheep", this.createCheep);

        this.useMiddleware(checkSession, [ "/create" ]);
    }

    private async createCheep(req: Request, res: Response): Promise<any>
    {
        if(req.newCheepForm.quoteTarget === undefined && req.newCheepForm.content === undefined)
        {
            return this.error(res, new InvalidCheepContentResponse("Cheep must have content."));
        }

        let gallery = undefined;
        if(req.newCheepForm.gallery !== undefined && req.newCheepForm.gallery.length > 0)
        {
            gallery = req.newCheepForm.gallery;
        }

        try
        {
            var cheepDocument = await req.model.cheepsModel.cheep(
                {
                    author_id: req.session["authorId"],
                    date_created: new Date().getTime(),
                    response_target: req.newCheepForm.responseTarget,
                    quote_target: req.newCheepForm.quoteTarget,
                    content: req.newCheepForm.content,
                    gallery: gallery
                },
                req.model.usersModel,
                req.model.profilesModel
            );

            var userShortInformation = await req.model.usersModel.getShortInformation(req.session["userId"], req.model.profilesModel);
        }
        catch(err)
        {
            console.log(err);
            return this.error(res, new InternalServerErrorResponse());
        }

        res.status(StatusCode.Created).json(
            this.createCheepResponse(cheepDocument, userShortInformation)
        );
    }

    private createCheepResponse(cheep: CheepsDocument, userInfo: UserShortInformation): CheepResponse
    {
        return {
            id: cheep.id,
            author: userInfo,
            dateCreated: cheep.date_created,
            responseTarget: cheep.response_target,
            quoteTarget: cheep.quote_target,
            content: cheep.content,
            gallery: cheep.gallery,
            comments: cheep.comments,
            likes: cheep.likes,
            recheeps: cheep.recheeps
        };
    }
}

interface CheepResponse
{
    id: number;
    author: {
        handle: string;
        name: string;
        picture: string;
    };
    dateCreated: number;
    responseTarget?: number;
    quoteTarget?: number;
    content?: string;
    gallery?: Array<string>;
    comments: number;
    likes: number;
    recheeps: number;
}

export default CheepsRouter;