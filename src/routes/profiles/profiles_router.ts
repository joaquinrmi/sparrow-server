import { NextFunction, Request, Response } from "express";
import { UsersDocument } from "../../sparrow_model/users";
import { InternalServerErrorResponse, InvalidFormResponse, InvalidQueryResponse, ProfileNotFoundResponse } from "../error_response";
import Router from "../router";
import RouteMap, { MethodType } from "../route_map";
import StatusCode from "../status_code";
import checkSession from "../check_session";

class ProfilesRouter extends Router
{
    constructor()
    {
        super([
            new RouteMap(MethodType.Get, "/get", "getProfile"),
            new RouteMap(MethodType.Post, "/edit-profile", "editProfile")
        ]);

        this.registerFunction("getProfile", this.getProfile);
        this.registerFunction("editProfile", this.editProfile);

        this.useMiddleware(checkSession, [ "/get", "/edit-profile" ]);
        this.useMiddleware(this.checkEditProfileForm, [ "/edit-profile" ]);
    }

    private async getProfile(req: Request, res: Response): Promise<any>
    {
        if(req.query.handle === undefined)
        {
            return this.error(res, new InvalidQueryResponse());
        }

        try
        {
            var profileData = await req.model.profilesModel.getUserProfileData(req.session["userId"], String(req.query.handle));
        }
        catch(err)
        {
            console.log(err);
            return this.error(res, new InternalServerErrorResponse());
        }

        res.status(StatusCode.OK).json(profileData);
    }

    private async editProfile(req: Request, res: Response): Promise<any>
    {
        let counter = 0;
        for(let prop in req.editProfileForm)
        {
            if(req.editProfileForm[prop] !== undefined)
            {
                counter = 1;
                break;
            }
        }

        if(counter === 0)
        {
            return res.status(StatusCode.OK).json();
        }

        try
        {
            await req.model.profilesModel.edit(req.session["userId"], req.editProfileForm);
        }
        catch(err)
        {
            console.log(err);
            return this.error(res, new InternalServerErrorResponse());
        }

        res.status(StatusCode.OK).json();
    }

    private checkEditProfileForm(req: Request, res: Response, next: NextFunction): any
    {
        if(typeof req.body.banner !== "undefined" && typeof req.body.banner !== "string")
        {
            return this.error(res, new InvalidFormResponse());
        }

        if(typeof req.body.picture !== "undefined" && typeof req.body.picture !== "string")
        {
            return this.error(res, new InvalidFormResponse());
        }

        if(typeof req.body.name !== "undefined" && typeof req.body.name !== "string")
        {
            return this.error(res, new InvalidFormResponse());
        }

        if(typeof req.body.description !== "undefined" && typeof req.body.description !== "string")
        {
            return this.error(res, new InvalidFormResponse());
        }

        if(typeof req.body.location !== "undefined" && typeof req.body.location !== "string")
        {
            return this.error(res, new InvalidFormResponse());
        }

        if(typeof req.body.website !== "undefined" && typeof req.body.website !== "string")
        {
            return this.error(res, new InvalidFormResponse());
        }

        if(typeof req.body.birthdate !== "undefined" && typeof req.body.birthdate !== "number")
        {
            return this.error(res, new InvalidFormResponse());
        }

        req.editProfileForm = {
            banner: req.body.banner,
            picture: req.body.picture,
            name: req.body.name,
            description: req.body.description,
            location: req.body.location,
            website: req.body.website,
            birthday: req.body.birthdate
        };

        next();
    }
}

export default ProfilesRouter;