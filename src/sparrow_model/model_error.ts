class ModelError
{
    type: ModelErrorType;
    message?: string;

    constructor(type: ModelErrorType, message?: string)
    {
        this.type = type;
        this.message = message;
    }
}

export class DBError extends ModelError
{
    error: any;

    constructor(error: any)
    {
        super(ModelErrorType.DBError);

        this.error = error;
    }
}

export enum ModelErrorType
{
    DBError,
    UnavailableHandle
}

export default ModelError;