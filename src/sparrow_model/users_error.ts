import ModelError, { ModelErrorType } from "./model_error";

class UnavailableHandle extends ModelError
{
    constructor()
    {
        super(ModelErrorType.UnavailableHandle, "The handle is unavailable");
    }
}

export default UnavailableHandle;