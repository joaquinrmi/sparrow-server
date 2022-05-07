import { Request, Response } from "express";
import { UsersDocument } from "../../sparrow_model/users";
import { InternalServerErrorResponse, InvalidQueryResponse, ProfileNotFoundResponse } from "../error_response";
import Router from "../router";
import RouteMap, { MethodType } from "../route_map";
import StatusCode from "../status_code";

class ProfilesRouter extends Router
{
    constructor()
    {
        super([
            new RouteMap(MethodType.Get, "/get", "getProfile")
        ]);

        this.registerFunction("getProfile", this.getProfile);
    }

    private async getProfile(req: Request, res: Response): Promise<any>
    {
        if(typeof req.query.handle !== "string")
        {
            return this.error(res, new InvalidQueryResponse());
        }

        try
        {
            var searchResult = await req.model.profilesModel.innerJoin<UsersDocument>(
                {
                    firstConditions: {},
                    secondConditions: {
                        props: [
                            {
                                handle: req.query.handle
                            }
                        ]
                    },
                    joinConditions: {
                        id: "id"
                    }
                },
                {},
                req.model.usersModel
            );
        }
        catch(err)
        {
            console.log(err);
            return this.error(res, new InternalServerErrorResponse());
        }

        if(searchResult.length === 0)
        {
            return this.error(res, new ProfileNotFoundResponse(req.query.handle));
        }

        let profileDocument = searchResult[0].firstDocuments;

        res.status(StatusCode.OK).json({
            handle: req.query.handle,
            name: profileDocument.name,
            picture: profileDocument.picture,
            banner: profileDocument.banner,
            joinDate: Number(profileDocument.join_date),
            birthdate: profileDocument.birth_date !== null ? Number(profileDocument.birth_date) : null,
            location: profileDocument.location,
            website: profileDocument.website,
            following: profileDocument.following,
            followers: profileDocument.followers,
            cheepCount: profileDocument.cheeps
        });
    }
}

export default ProfilesRouter;