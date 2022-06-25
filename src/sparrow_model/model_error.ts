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

export enum ModelErrorType
{
    UnavailableHandle
}

export default ModelError;