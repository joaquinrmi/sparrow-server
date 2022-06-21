import { NextFunction, Request, Response } from "express";
import checkSession from "../check_session";
import { CannotDeleteCheepResponse, CheepDoesNotExistResponse, InternalServerErrorResponse, InvalidCheepContentResponse, InvalidFormResponse, InvalidQueryResponse } from "../error_response";
import Router from "../router";
import RouteMap, { MethodType } from "../route_map";
import StatusCode from "../status_code";
import { CheepData, SearchCheepsParameters } from "../../sparrow_model/cheeps";

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
            new RouteMap(MethodType.Post, "/unlike", "unlikeCheep"),
            new RouteMap(MethodType.Post, "/delete", "deleteCheep"),
            new RouteMap(MethodType.Post, "/delete-recheep", "deleteRecheep"),
            new RouteMap(MethodType.Get, "/search", "searchCheeps")
        ]);

        this.registerFunction("createCheep", this.createCheep);
        this.registerFunction("getCheep", this.getCheep);
        this.registerFunction("getTimeline", this.getTimeline);
        this.registerFunction("getLikedCheeps", this.getLikedCheeps);
        this.registerFunction("likeCheep", this.likeCheep);
        this.registerFunction("unlikeCheep", this.unlikeCheep);
        this.registerFunction("deleteCheep", this.deleteCheep);
        this.registerFunction("deleteRecheep", this.deleteRecheep);
        this.registerFunction("searchCheeps", this.searchCheeps);

        this.useMiddleware(checkSession, [ "/create", "/timeline", "/like", "/unlike", "/delete", "/delete-recheep", "/search" ]);
        this.useMiddleware(this.checkNewCheepForm, [ "/create" ]);
    }

    private async createCheep(req: Request, res: Response): Promise<any>
    {
        if(req.newCheepForm.quoteTarget === undefined && req.newCheepForm.content === undefined && (req.newCheepForm.gallery === undefined || req.newCheepForm.gallery.length === 0))
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
                }
            );
        }
        catch(err)
        {
            console.log(err);
            return this.error(res, new InternalServerErrorResponse());
        }

        if(cheepDocument === null)
        {
            return res.status(StatusCode.OK).json();
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
            var cheepData = await req.model.cheepsModel.getCheep(req.session["userId"], Number(req.query.cheepId));
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
            var timeline = await req.model.cheepsModel.getTimeline(req.session["userId"], req.session["userId"], maxTime);
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
            var likedCheeps = await req.model.cheepsModel.getLikedCheeps(req.session["userId"], req.query.userHandle, maxTime);
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
            await req.model.cheepsModel.registerNewLike(req.session["userId"], Number(req.query.cheepId));
        }
        catch(err)
        {
            console.log(err);
            return this.error(res, new InternalServerErrorResponse());
        }

        res.status(StatusCode.OK).json();
    }

    private async unlikeCheep(req: Request, res: Response): Promise<any>
    {
        if(req.query.cheepId === undefined)
        {
            return this.error(res, new InvalidQueryResponse());
        }

        try
        {
            await req.model.cheepsModel.deleteLike(req.session["userId"], Number(req.query.cheepId));
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
        if(typeof req.query.cheepId === undefined)
        {
            return this.error(res, new InvalidQueryResponse());
        }

        try
        {
            var deleted = await req.model.cheepsModel.deleteCheep(req.session["userId"], Number(req.query.cheepId));
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

    private async deleteRecheep(req: Request, res: Response): Promise<any>
    {
        if(req.query.targetId === undefined)
        {
            return this.error(res, new InvalidQueryResponse());
        }

        try
        {
            var deleted = await req.model.cheepsModel.deleteRecheep(req.session["userId"], Number(req.query.targetId));
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
        const searchCheepsParameters: SearchCheepsParameters = {
            words: [],
            maxTime: new Date().getTime(),
            responses: true,
            onlyGallery: false,
            responseOf: -1
        };

        if(req.query.words !== undefined)
        {
            if(typeof req.query.words !== "string")
            {
                return this.error(res, new InvalidQueryResponse());
            }

            searchCheepsParameters.words = (req.query.words as string).split(" ");
        }

        if(req.query.maxTime !== undefined)
        {
            searchCheepsParameters.maxTime = Number(req.query.maxTime);
        }

        if(req.query.userHandle !== undefined)
        {
            if(typeof req.query.userHandle !== "string")
            {
                return this.error(res, new InvalidQueryResponse());
            }

            searchCheepsParameters.userHandle = req.query.userHandle;
        }

        let likes = false;
        if(req.query.likes !== undefined)
        {
            likes = Boolean(req.query.likes);
        }

        if(req.query.responses !== undefined)
        {
            if(req.query.responses === "true")
            {
                searchCheepsParameters.responses = true;
            }
            else
            {
                searchCheepsParameters.responses = false;
            }
        }

        if(req.query.onlyGallery !== undefined)
        {
            searchCheepsParameters.onlyGallery = Boolean(req.query.onlyGallery);
        }

        if(req.query.responseOf !== undefined)
        {
            searchCheepsParameters.responseOf = Number(req.query.responseOf);
        }

        let cheeps: Array<CheepData>;
        try
        {
            if(likes)
            {
                cheeps = await req.model.cheepsModel.getLikedCheeps(req.session["userId"], searchCheepsParameters.userHandle, searchCheepsParameters.maxTime);
            }
            else
            {
                cheeps = await req.model.cheepsModel.searchCheeps(req.session["userId"], searchCheepsParameters);
            }
        }
        catch(err)
        {
            console.log(err);
            return this.error(res, new InternalServerErrorResponse());
        }

        let nextTime = searchCheepsParameters.maxTime;
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