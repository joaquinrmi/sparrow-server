import { Request, Response, NextFunction } from "express";
import { InternalServerErrorResponse, InvalidCredentialsResponse, InvalidFormResponse, InvalidQueryResponse, UserAlreadyExistsResponse } from "../error_response";
import ErrorType from "../error_type";
import Router from "../router";
import RouteMap, { MethodType } from "../route_map";
import StatusCode from "../status_code";
import { encrypt } from "../../encryption";
import checkSession from "../check_session";

class UsersRouter extends Router
{
    constructor()
    {
        super([
            new RouteMap(MethodType.Post, "/create", "createNewUser"),
            new RouteMap(MethodType.Post, "/login", "login"),
            new RouteMap(MethodType.Post, "/logout", "logout"),
            new RouteMap(MethodType.Get, "/user-info", "getUserInformation"),
            new RouteMap(MethodType.Post, "/follow", "followUser"),
            new RouteMap(MethodType.Post, "/unfollow", "unfollowUser"),
            new RouteMap(MethodType.Get, "/follower-list", "getFollowers")
        ]);

        this.registerFunction("createNewUser", this.createNewUser);
        this.registerFunction("login", this.login);
        this.registerFunction("logout", this.logout);
        this.registerFunction("getUserInformation", this.getUserInformation);
        this.registerFunction("followUser", this.followUser);
        this.registerFunction("unfollowUser", this.unfollowUser);
        this.registerFunction("getFollowers", this.getFollowers);

        this.useMiddleware(this.checkNewUserForm, [ "/create", "/follow", "/unfollow", "/follower-list" ]);
        this.useMiddleware(this.checkLoginForm, [ "/login" ]);
        this.useMiddleware(checkSession, [ "/user-info" ]);
    }

    private async createNewUser(req: Request, res: Response): Promise<any>
    {
        try
        {
            var handleExists = await req.model.usersModel.exists({
                props: [
                    {
                        handle: req.newUserForm.handle
                    }
                ]
            });

            var emailExists = await req.model.usersModel.exists({
                props: [
                    {
                        email: req.newUserForm.email
                    }
                ]
            });
        }
        catch(err)
        {
            console.log(err);
            return this.error(res, new InternalServerErrorResponse());
        }

        let errors = new Array<ErrorType>();

        if(handleExists)
        {
            errors.push(ErrorType.HandleAlreadyExists);
        }

        if(emailExists)
        {
            errors.push(ErrorType.EmailAlreadyExists);
        }

        if(errors.length > 0)
        {
            return this.error(res, new UserAlreadyExistsResponse(errors));
        }

        try
        {
            var profileDocument = await req.model.profilesModel.create({
                name: req.newUserForm.fullName,
                birth_date: req.newUserForm.birthdate,
                picture: "",
                join_date: new Date().getTime()
            });
        }
        catch(err)
        {
            console.log(err);
            return this.error(res, new InternalServerErrorResponse());
        }

        try
        {
            var userDocument = await req.model.usersModel.create({
                handle: req.newUserForm.handle,
                email: req.newUserForm.email,
                password: encrypt(req.newUserForm.password),
                profile_id: profileDocument.id
            });
        }
        catch(err)
        {
            console.log(err);
            return this.error(res, new InternalServerErrorResponse());
        }

        res.status(StatusCode.Created).json({
            handle: userDocument.handle
        });
    }

    private async login(req: Request, res: Response): Promise<any>
    {
        try
        {
            var userDocument = await req.model.usersModel.validate(req.loginForm.handleOrEmail, req.loginForm.password);
        }
        catch(err)
        {
            console.log(err);
            return this.error(res, new InternalServerErrorResponse());
        }

        if(userDocument === null)
        {
            return this.error(res, new InvalidCredentialsResponse());
        }

        if(req.loginForm.remember)
        {
            try
            {
                var sessionKey = await req.model.sessionsModel.registerNewSession(userDocument.id);
            }
            catch(err)
            {
                console.log(err);
                return this.error(res, new InternalServerErrorResponse());
            }

            res.cookie(
                "session",
                JSON.stringify({
                    id: userDocument.id,
                    key: sessionKey
                }),
                {
                    maxAge: 30 * 24 * 60 * 60 * 1000
                }
            );
        }

        req.session["userId"] = userDocument.id;
        req.session.save();

        try
        {
            var profileDocuments = await req.model.profilesModel.find({
                props: [
                    {
                        id: userDocument.id
                    }
                ]
            }, [ "name", "picture" ]);
        }
        catch(err)
        {
            console.log(err);
            return this.error(res, new InternalServerErrorResponse());
        }

        if(profileDocuments.length === 0)
        {
            return this.error(res, new InternalServerErrorResponse());
        }

        const profile = profileDocuments[0];

        res.status(StatusCode.OK).json({
            handle: userDocument.handle,
            name: profile.name,
            picture: profile.picture
        });
    }

    private async logout(req: Request, res: Response): Promise<any>
    {
        if(typeof req.cookies["session"] === "object")
        {
            try
            {
                await req.model.sessionsModel.unregisterSession(req.cookies["session"].userId, req.cookies["session"].key);
            }
            catch(err)
            {
                console.log(err);
                return this.error(res, new InternalServerErrorResponse());
            }

            res.cookie("session", JSON.stringify(null));
        }

        req.session["userId"] = undefined;
        req.session.save();

        res.status(StatusCode.OK).json({});
    }

    private async getUserInformation(req: Request, res: Response): Promise<any>
    {
        try
        {
            var userShortInformation = await req.model.usersModel.getShortInformation(req.session["userId"], req.model.profilesModel);
        }
        catch(err)
        {
            console.log(err);
            return this.error(res, new InternalServerErrorResponse());
        }

        res.status(StatusCode.OK).json(userShortInformation);
    }

    private async followUser(req: Request, res: Response): Promise<any>
    {
        if(typeof req.query.userId !== "number" && typeof req.query.userId !== "string")
        {
            return this.error(res, new InvalidQueryResponse());
        }

        try
        {
            var followed = await req.model.usersModel.follow(req.session["userId"], Number(req.query.userId), req.model.followsModel);
        }
        catch(err)
        {
            console.log(err);
            return this.error(res, new InternalServerErrorResponse());
        }

        if(followed)
        {
            res.status(StatusCode.Created).json();
        }
        else
        {
            res.status(StatusCode.Conflict).json();
        }
    }

    private async unfollowUser(req: Request, res: Response): Promise<any>
    {
        if(typeof req.query.userId !== "number" && typeof req.query.userId !== "string")
        {
            return this.error(res, new InvalidQueryResponse());
        }

        try
        {
            var unfollowed = await req.model.usersModel.unfollow(req.session["userId"], Number(req.query.userId), req.model.followsModel);
        }
        catch(err)
        {
            console.log(err);
            return this.error(res, new InternalServerErrorResponse());
        }

        if(unfollowed)
        {
            res.status(StatusCode.OK).json();
        }
        else
        {
            res.status(StatusCode.Conflict).json();
        }
    }

    private async getFollowers(req: Request, res: Response): Promise<any>
    {
        if(typeof req.query.userId !== "number" && typeof req.query.userId !== "string")
        {
            return this.error(res, new InvalidQueryResponse());
        }

        let offset = Number.MAX_SAFE_INTEGER;
        if(typeof req.query.offset === "number" || typeof req.query.offset === "string")
        {
            offset = Number(req.query.offset);
        }

        try
        {
            var followers = await req.model.followsModel.getFollowers(req.session["userId"], Number(req.query.userId), offset);
        }
        catch(err)
        {
            console.log(err);
            return this.error(res, new InternalServerErrorResponse());
        }

        res.status(StatusCode.OK).json(followers);
    }

    private async checkNewUserForm(req: Request, res: Response, next: NextFunction): Promise<any>
    {
        if(!req.body)
        {
            return this.error(res, new InvalidFormResponse());
        }

        if(typeof req.body.handle !== "string")
        {
            return this.error(res, new InvalidFormResponse("'handle' must be of type 'string'."));
        }

        if(typeof req.body.email !== "string")
        {
            return this.error(res, new InvalidFormResponse("'email' must be of type 'string'."));
        }

        if(typeof req.body.password !== "string")
        {
            return this.error(res, new InvalidFormResponse("'password' must be of type 'string'."));
        }

        if(typeof req.body.fullName !== "string")
        {
            return this.error(res, new InvalidFormResponse("'fullName' must be of type 'string'."));
        }

        if(typeof req.body.birthdate !== "number")
        {
            return this.error(res, new InvalidFormResponse("'birthdate' must be of type 'number'."));
        }

        req.newUserForm = {
            handle: req.body.handle,
            email: req.body.email,
            password: req.body.password,
            fullName: req.body.fullName,
            birthdate: req.body.birthdate
        };

        next();
    }

    private async checkLoginForm(req: Request, res: Response, next: NextFunction): Promise<any>
    {
        if(req.body === undefined)
        {
            return this.error(res, new InvalidFormResponse());
        }

        if(typeof req.body.handleOrEmail !== "string")
        {
            return this.error(res, new InvalidFormResponse());
        }

        if(typeof req.body.password !== "string")
        {
            return this.error(res, new InvalidFormResponse());
        }

        if(typeof req.body.remember !== "boolean")
        {
            return this.error(res, new InvalidFormResponse());
        }

        req.loginForm = {
            handleOrEmail: req.body.handleOrEmail,
            password: req.body.password,
            remember: req.body.remember
        };

        next();
    }
}

export default UsersRouter;