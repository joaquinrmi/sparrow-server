import { NextFunction, Request, Response } from "express";
import { SessionDoesNotExistResponse } from "./error_response";
import StatusCode from "./status_code";

async function checkSession(req: Request, res: Response, next: NextFunction): Promise<any>
{
    if(req.session["userId"] === undefined)
    {
        return res.status(StatusCode.Unauthorized).json(new SessionDoesNotExistResponse());
    }

    next();
}

export default checkSession;