import ErrorType from "./error_type";
import StatusCode from "./status_code";

class ErrorResponse
{
    status: StatusCode;
    error: Array<ErrorType>;
    message: string;

    constructor(status: StatusCode, error: Array<ErrorType>, message?: string)
    {
        this.status = status;
        this.error = error;
        this.message = message || "No message available";
    }
}

export class InvalidQueryResponse extends ErrorResponse
{
    constructor(message?: string)
    {
        super(StatusCode.BadRequest, [ErrorType.InvalidQuery], message);
    }
}

export class InvalidFormResponse extends ErrorResponse
{
    constructor(message?: string)
    {
        super(StatusCode.BadRequest, [ErrorType.InvalidForm], message);
    }
}

export class InternalServerErrorResponse extends ErrorResponse
{
    constructor()
    {
        super(StatusCode.InternalServerError, [ErrorType.InternalServerError]);
    }
}

export class UserAlreadyExistsResponse extends ErrorResponse
{
    constructor(error: Array<ErrorType>)
    {
        super(StatusCode.Conflict, error);
    }
}

export default ErrorResponse;