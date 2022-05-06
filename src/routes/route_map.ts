export enum MethodType
{
    Get = "get",
    Post = "post",
    Put = "put",
    Delete = "delete"
}

class RouteMap
{
    method: MethodType;
    path: string;
    func: string;

    constructor(method: MethodType, path: string, func: string)
    {
        this.method = method;
        this.path = path;
        this.func = func;
    }
}

export default RouteMap;