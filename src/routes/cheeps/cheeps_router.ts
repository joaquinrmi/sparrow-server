import { NextFunction, Request, Response } from "express";
import checkSession from "../check_session";
import { CannotDeleteCheepResponse, CheepDoesNotExistResponse, InternalServerErrorResponse, InvalidCheepContentResponse, InvalidFormResponse, InvalidQueryResponse } from "../error_response";
import Router from "../router";
import RouteMap, { MethodType } from "../route_map";
import StatusCode from "../status_code";

class CheepsRouter extends Router
{
    constructor()
    {
        super([
            new RouteMap(MethodType.Post, "/create", "createCheep"),
            new RouteMap(MethodType.Get, "/get", "getCheep"),
            new RouteMap(MethodType.Get, "/timeline", "getTimeline"),
            new RouteMap(MethodType.Get, "/liked-list", "getLikedCheeps"),
            new RouteMap(MethodType.Post, "/like", "likeCheep"),
            new RouteMap(MethodType.Post, "/delete", "deleteCheep"),
            new RouteMap(MethodType.Get, "/search", "searchCheeps")
        ]);

        this.registerFunction("createCheep", this.createCheep);
        this.registerFunction("getCheep", this.getCheep);
        this.registerFunction("getTimeline", this.getTimeline);
        this.registerFunction("getLikedCheeps", this.getLikedCheeps);
        this.registerFunction("likeCheep", this.likeCheep);
        this.registerFunction("deleteCheep", this.deleteCheep);
        this.registerFunction("searchCheeps", this.searchCheeps);

        this.useMiddleware(checkSession, [ "/create", "/timeline", "/like", "/delete", "/search" ]);
        this.useMiddleware(this.checkNewCheepForm, [ "/create" ]);
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

        if(req.newCheepForm.content !== undefined)
        {
            if(req.newCheepForm.content.length > 280)
            {
                return this.error(res, new InvalidFormResponse("Cheeps must have 280 character or less."));
            }
        }

        try
        {
            var cheepDocument = await req.model.cheepsModel.cheep(
                {
                    author_id: req.session["userId"],
                    date_created: new Date().getTime(),
                    response_target: req.newCheepForm.responseTarget,
                    quote_target: req.newCheepForm.quoteTarget,
                    content: req.newCheepForm.content,
                    gallery: gallery
                },
                req.model.usersModel,
                req.model.profilesModel
            );
        }
        catch(err)
        {
            console.log(err);
            return this.error(res, new InternalServerErrorResponse());
        }

        res.status(StatusCode.Created).json(cheepDocument.id);
    }

    private async getCheep(req: Request, res: Response): Promise<any>
    {
        if(typeof req.query.cheepId !== "string")
        {
            return this.error(res, new InvalidQueryResponse());
        }

        try
        {
            var cheepData = await req.model.cheepsModel.getCheep(Number(req.query.cheepId));
        }
        catch(err)
        {
            console.log(err);
            return this.error(res, new InternalServerErrorResponse());
        }

        if(cheepData === null)
        {
            return this.error(res, new CheepDoesNotExistResponse(Number(req.query.cheepId)));
        }

        res.status(StatusCode.OK).json(cheepData);
    }

    private async getTimeline(req: Request, res: Response): Promise<any>
    {
        let maxTime = new Date().getTime();
        if(typeof req.query.maxTime === "number")
        {
            maxTime = req.query.maxTime;
        }

        try
        {
            var timeline = await req.model.cheepsModel.getTimeline(req.session["userId"], maxTime);
        }
        catch(err)
        {
            console.log(err);
            return this.error(res, new InternalServerErrorResponse());
        }

        let nextTime = maxTime;
        if(timeline.length > 0)
        {
            nextTime = timeline[timeline.length - 1].dateCreated;
        }

        res.status(StatusCode.OK).json({
            cheeps: timeline,
            nextTime: nextTime
        });
    }

    private async getLikedCheeps(req: Request, res: Response): Promise<any>
    {
        let maxTime = new Date().getTime();
        if(req.query.maxTime !== undefined)
        {
            maxTime = Number(req.query.maxTime);
        }

        if(typeof req.query.userHandle !== "string")
        {
            return this.error(res, new InvalidQueryResponse());
        }

        try
        {
            var likedCheeps = await req.model.cheepsModel.getLikedCheeps(req.query.userHandle, maxTime, req.model.usersModel);
        }
        catch(err)
        {
            console.log(err);
            return this.error(res, new InternalServerErrorResponse());
        }

        let nextTime = maxTime;
        if(likedCheeps.length > 0)
        {
            nextTime = likedCheeps[likedCheeps.length - 1].dateCreated;
        }

        res.status(StatusCode.OK).json({
            cheeps: likedCheeps,
            nextTime: nextTime
        });
    }

    private async likeCheep(req: Request, res: Response): Promise<any>
    {
        if(req.query.cheepId === undefined)
        {
            return this.error(res, new InvalidQueryResponse());
        }

        try
        {
            await req.model.cheepsModel.registerNewLike(req.session["userId"], Number(req.query.cheepId), req.model.likesModel);
        }
        catch(err)
        {
            console.log(err);
            return this.error(res, new InternalServerErrorResponse());
        }

        res.status(StatusCode.OK).json();
    }

    private async deleteCheep(req: Request, res: Response): Promise<any>
    {
        if(typeof req.query.cheepId !== "number")
        {
            return this.error(res, new InvalidQueryResponse());
        }

        try
        {
            var deleted = await req.model.cheepsModel.deleteCheep(req.session["userId"], req.query.cheepId);
        }
        catch(err)
        {
            console.log(err);
            return this.error(res, new InternalServerErrorResponse());
        }

        if(deleted)
        {
            return res.status(StatusCode.OK).json();
        }
        else
        {
            return this.error(res, new CannotDeleteCheepResponse());
        }
    }

    private async searchCheeps(req: Request, res: Response): Promise<any>
    {
        let words = new Array<string>();
        if(req.query.words !== undefined)
        {
            if(typeof req.query.words !== "string")
            {
                return this.error(res, new InvalidQueryResponse());
            }

            words = (req.query.words as string).split(" ");
        }

        let maxTime = new Date().getTime();
        if(req.query.maxTime !== undefined)
        {
            if(typeof req.query.maxTime !== "number")
            {
                return this.error(res, new InvalidQueryResponse());
            }

            maxTime = req.query.maxTime;
        }

        let userHandle: string;
        if(req.query.userHandle !== undefined)
        {
            if(typeof req.query.userHandle !== "string")
            {
                return this.error(res, new InvalidQueryResponse());
            }

            userHandle = req.query.userHandle;
        }

        let responses = true;
        if(req.query.responses !== undefined)
        {
            responses = Boolean(req.query.responses);
        }

        let onlyGallery = false;
        if(req.query.onlyGallery !== undefined)
        {
            onlyGallery = Boolean(req.query.onlyGallery);
        }

        try
        {
            var cheeps = await req.model.cheepsModel.searchCheeps(words, maxTime, responses, onlyGallery, userHandle);
        }
        catch(err)
        {
            console.log(err);
            return this.error(res, new InternalServerErrorResponse());
        }

        let nextTime = maxTime;
        if(cheeps.length > 0)
        {
            nextTime = cheeps[cheeps.length - 1].dateCreated;
        }

        res.status(StatusCode.OK).json({
            cheeps: cheeps,
            nextTime: nextTime
        });
    }

    private checkNewCheepForm(req: Request, res: Response, next: NextFunction): Promise<any>
    {
        if(typeof req.body !== "object")
        {
            return this.error(res, new InvalidFormResponse());
        }

        if(req.body.responseTarget !== undefined && typeof req.body.responseTarget !== "number")
        {
            return this.error(res, new InvalidFormResponse());
        }

        if(req.body.quoteTarget !== undefined && typeof req.body.quoteTarget !== "number")
        {
            return this.error(res, new InvalidFormResponse());
        }

        if(req.body.content !== undefined && typeof req.body.content !== "string")
        {
            return this.error(res, new InvalidFormResponse());
        }

        if(req.body.gallery !== undefined && !Array.isArray(req.body.gallery))
        {
            return this.error(res, new InvalidFormResponse());
        }

        req.newCheepForm = {
            responseTarget: req.body.responseTarget,
            quoteTarget: req.body.quoteTarget,
            content: req.body.content,
            gallery: req.body.gallery
        };

        next();
    }
}

export default CheepsRouter;