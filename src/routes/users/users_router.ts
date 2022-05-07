import { Request, Response, NextFunction } from "express";
import { InternalServerErrorResponse, InvalidCredentialsResponse, InvalidFormResponse, UserAlreadyExistsResponse } from "../error_response";
import ErrorType from "../error_type";
import Router from "../router";
import RouteMap, { MethodType } from "../route_map";
import StatusCode from "../status_code";
import { encrypt } from "../../encryption";

class UsersRouter extends Router
{
    constructor()
    {
        super([
            new RouteMap(MethodType.Post, "/create", "createNewUser"),
            new RouteMap(MethodType.Post, "/login", "login")
        ]);

        this.registerFunction("createNewUser", this.createNewUser);
        this.registerFunction("login", this.login);

        this.useMiddleware(this.checkNewUserForm, [ "/create" ]);
        this.useMiddleware(this.checkLoginForm, [ "/login" ]);
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

        res.status(StatusCode.OK).json({
            handle: userDocument.handle
        });
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