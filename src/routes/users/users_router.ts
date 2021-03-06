import { Request, Response, NextFunction } from "express";
import { InternalServerErrorResponse, InvalidCredentialsResponse, InvalidFormResponse, UserAlreadyExistsResponse } from "../error_response";
import ErrorType from "../error_type";
import Router from "../router";
import RouteMap, { MethodType } from "../route_map";
import StatusCode from "../status_code";
import checkSession from "../check_session";
import SearchUsersForm from "./search_users_form";

class UsersRouter extends Router
{
    constructor()
    {
        super([
            new RouteMap(MethodType.Post, "/create", "createNewUser"),
            new RouteMap(MethodType.Post, "/login", "login"),
            new RouteMap(MethodType.Post, "/restore-session", "restoreSession"),
            new RouteMap(MethodType.Post, "/logout", "logout"),
            new RouteMap(MethodType.Get, "/user-info", "getUserInformation"),
            new RouteMap(MethodType.Post, "/follow", "followUser"),
            new RouteMap(MethodType.Post, "/unfollow", "unfollowUser"),
            new RouteMap(MethodType.Get, "/follower-list", "getFollowers"),
            new RouteMap(MethodType.Get, "/following-list", "getFollowing"),
            new RouteMap(MethodType.Get, "/recommended-list", "getRecommended"),
            new RouteMap(MethodType.Get, "/like-target-list", "getUsersLike"),
            new RouteMap(MethodType.Get, "/recheep-target-list", "getUsersRecheep"),
            new RouteMap(MethodType.Get, "/search", "searchUsers")
        ]);

        this.registerFunction("createNewUser", this.createNewUser);
        this.registerFunction("login", this.login);
        this.registerFunction("restoreSession", this.restoreSession);
        this.registerFunction("logout", this.logout);
        this.registerFunction("getUserInformation", this.getUserInformation);
        this.registerFunction("followUser", this.followUser);
        this.registerFunction("unfollowUser", this.unfollowUser);
        this.registerFunction("getFollowers", this.getFollowers);
        this.registerFunction("getFollowing", this.getFollowing);
        this.registerFunction("getRecommended", this.getRecommended);
        this.registerFunction("getUsersLike", this.getUsersLike);
        this.registerFunction("getUsersRecheep", this.getUsersRecheep);
        this.registerFunction("searchUsers", this.searchUsers);

        this.useMiddleware(this.checkNewUserForm, [ "/create" ]);
        this.useMiddleware(this.checkLoginForm, [ "/login" ]);

        this.useMiddleware(checkSession, [ "/user-info", "/follow", "/unfollow", "/follower-list", "/following-list", "/recommended-list", "/like-target-list", "/recheep-target-list", "/search" ]);
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
            var userDocument = await req.model.usersModel.createNewUser(
                {
                    name: req.newUserForm.fullName,
                    birthdate: req.newUserForm.birthdate,
                    picture: "",
                    join_date: new Date().getTime()
                },
                {
                    handle: req.newUserForm.handle,
                    email: req.newUserForm.email,
                    password: req.newUserForm.password,
                    profile_id: 0
                }
            );
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

    private async restoreSession(req: Request, res: Response): Promise<any>
    {
        if(req.cookies["session"])
        {
            const cookie = JSON.parse(req.cookies["session"]);

            if(cookie === undefined || cookie === null)
            {
            	return res.status(StatusCode.Unauthorized).json();
            }

            const userId = cookie.id;
            const sessionKey = cookie.key;

            try
            {
                var exists = await req.model.sessionsModel.checkSession(userId, sessionKey);
            }
            catch(err)
            {
                console.log(err);
                return this.error(res, new InternalServerErrorResponse());
            }

            if(!exists)
            {
                return res.status(StatusCode.Unauthorized).json();
            }

            try
            {
                var userShortInformation = await req.model.usersModel.getShortInformation(userId, req.model.profilesModel);
            }
            catch(err)
            {
                console.log(err);
                return this.error(res, new InternalServerErrorResponse());
            }

            if(userShortInformation === null)
            {
                return res.status(StatusCode.Unauthorized).json();
            }

            res.cookie(
                "session",
                JSON.stringify({
                    id: userId,
                    key: sessionKey
                }),
                {
                    maxAge: 30 * 24 * 60 * 60 * 1000
                }
            );

            req.session["userId"] = userId;
            req.session.save();

            res.status(StatusCode.OK).json(userShortInformation);
        }

        res.status(StatusCode.Unauthorized).json();
    }

    private async logout(req: Request, res: Response): Promise<any>
    {
        if(req.cookies["session"] !== undefined)
        {
        	const cookie = JSON.parse(req.cookies["session"]);

        	if(cookie.id !== undefined && cookie.key !== undefined)
        	{
        		try
	            {
	                await req.model.sessionsModel.unregisterSession(cookie.id, cookie.key);
	            }
	            catch(err)
	            {
	                console.log(err);
	                return this.error(res, new InternalServerErrorResponse());
	            }

	            res.cookie("session", JSON.stringify(null));
        	}
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
        if(req.body.userHandle === undefined)
        {
            return this.error(res, new InvalidFormResponse());
        }

        try
        {
            var followed = await req.model.usersModel.follow(req.session["userId"], req.body.userHandle, req.model.followsModel);
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
        if(req.body.userHandle === undefined)
        {
            return this.error(res, new InvalidFormResponse());
        }

        try
        {
            var followed = await req.model.usersModel.unfollow(req.session["userId"], req.body.userHandle, req.model.followsModel);
        }
        catch(err)
        {
            console.log(err);
            return this.error(res, new InternalServerErrorResponse());
        }

        if(followed)
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
        if(typeof req.query.userHandle !== "string")
        {
            return this.error(res, new InvalidFormResponse());
        }

        let offsetId = 2_147_483_647;
        if(req.query.offsetId !== undefined)
        {
            offsetId = Number(req.query.offsetId);
        }

        try
        {
            var followers = await req.model.followsModel.getFollowers(req.session["userId"], String(req.query.userHandle), offsetId);
        }
        catch(err)
        {
            console.log(err);
            return this.error(res, new InternalServerErrorResponse());
        }

        res.status(StatusCode.OK).json(followers);
    }

    private async getFollowing(req: Request, res: Response): Promise<any>
    {
        if(typeof req.query.userHandle !== "string")
        {
            return this.error(res, new InvalidFormResponse());
        }

        let offsetId = 2_147_483_647;
        if(req.query.offsetId !== undefined)
        {
            offsetId = Number(req.query.offsetId);
        }

        try
        {
            var followers = await req.model.followsModel.getFollowing(req.session["userId"], String(req.query.userHandle), offsetId);
        }
        catch(err)
        {
            console.log(err);
            return this.error(res, new InternalServerErrorResponse());
        }

        res.status(StatusCode.OK).json(followers);
    }

    private async getRecommended(req: Request, res: Response): Promise<any>
    {
        let offsetId = 2_147_483_647;
        if(req.query.offsetId !== undefined)
        {
            offsetId = Number(req.query.offsetId);
        }

        try
        {
            var recommended = await req.model.usersModel.getRecommendedList(req.session["userId"], offsetId)
        }
        catch(err)
        {
            console.log(err);
            return this.error(res, new InternalServerErrorResponse());
        }

        res.status(StatusCode.OK).json(recommended);
    }

    private async getUsersLike(req: Request, res: Response): Promise<any>
    {
        let offsetId: number | undefined;
        if(req.query.offsetId !== undefined)
        {
            offsetId = Number(req.query.offsetId);
        }

        let likeTarget: number;
        if(req.query.likeTarget === undefined)
        {
            return this.error(res, new InvalidFormResponse());
        }
        else
        {
            likeTarget = Number(req.query.likeTarget);
        }

        try
        {
            var usersLike = await req.model.usersModel.getUsersLike(req.session["userId"], likeTarget, offsetId);
        }
        catch(err)
        {
            console.log(err);
            return this.error(res, new InternalServerErrorResponse());
        }

        res.status(StatusCode.OK).json(usersLike);
    }

    private async getUsersRecheep(req: Request, res: Response): Promise<any>
    {
        let offsetId: number | undefined;
        if(req.query.offsetId !== undefined)
        {
            offsetId = Number(req.query.offsetId);
        }

        let recheepTarget: number;
        if(req.query.recheepTarget === undefined)
        {
            return this.error(res, new InvalidFormResponse());
        }
        else
        {
            recheepTarget = Number(req.query.recheepTarget);
        }

        try
        {
            var usersLike = await req.model.usersModel.getUsersLike(req.session["userId"], recheepTarget, offsetId);
        }
        catch(err)
        {
            console.log(err);
            return this.error(res, new InternalServerErrorResponse());
        }

        res.status(StatusCode.OK).json(usersLike);
    }

    private async searchUsers(req: Request, res: Response): Promise<any>
    {
        let searchUsersForm: SearchUsersForm = {};

        if(req.query.nameOrHandle !== undefined)
        {
            searchUsersForm.nameOrHandle = String(req.query.nameOrHandle).split("+");
        }

        if(req.query.offsetId !== undefined)
        {
            searchUsersForm.offsetId = Number(req.query.offsetId);
        }

        try
        {
            var users = await req.model.usersModel.searchUsers(req.session["userId"], searchUsersForm);
        }
        catch(err)
        {
            console.log(err);
            return this.error(res, new InternalServerErrorResponse());
        }

        res.status(StatusCode.OK).json(users);
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