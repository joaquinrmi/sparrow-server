import { NextFunction, Request, Response } from "express";
import checkSession from "../check_session";
import { CheepDoesNotExistResponse, InternalServerErrorResponse, InvalidCheepContentResponse, InvalidFormResponse, InvalidQueryResponse } from "../error_response";
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
            new RouteMap(MethodType.Get, "/timeline", "getTimeline")
        ]);

        this.registerFunction("createCheep", this.createCheep);
        this.registerFunction("getCheep", this.getCheep);
        this.registerFunction("getTimeline", this.getTimeline);

        this.useMiddleware(checkSession, [ "/create", "/timeline" ]);
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
        if(typeof req.query.cheepId !== "number")
        {
            return this.error(res, new InvalidQueryResponse());
        }

        try
        {
            var cheepData = await req.model.cheepsModel.getCheep(req.query.cheepId);
        }
        catch(err)
        {
            console.log(err);
            return this.error(res, new InternalServerErrorResponse());
        }

        if(cheepData === null)
        {
            return this.error(res, new CheepDoesNotExistResponse(req.query.cheepId));
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