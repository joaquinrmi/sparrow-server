import * as express from "express";
import { Request, Response, NextFunction } from "express";
import RouteMap from "./route_map";

export type Middleware = (req: Request, res: Response, next: NextFunction) => any;

class Router
{
    private router: express.Router;
    private routeMapArray: Array<RouteMap>;
    private funcMap: Map<string, (req: Request, res: Response) => any>;

    constructor(routeMapArray: Array<RouteMap>)
    {
        this.router = express.Router();
        this.routeMapArray = routeMapArray;
        this.funcMap = new Map();
    }

    use(): express.Router
    {
        for(let i = 0; i < this.routeMapArray.length; ++i)
        {
            const routeMap = this.routeMapArray[i];

            let func = this.funcMap.get(routeMap.func)
            if(!func)
            {
                continue;
            }

            this.router[routeMap.method](
                routeMap.path,
                func.bind(this)
            );
        }

        return this.router;
    }

    protected registerFunction(name: string, func: (req: Request, res: Response) => any): void
    {
        this.funcMap.set(name, func);
    }

    protected useMiddleware(middleware: Middleware, routes: Array<string> = []): void
    {
        if(routes.length == 0)
        {
            for(let i = 0; i < this.routeMapArray.length; ++i)
            {
                routes.push(this.routeMapArray[i].path);
            }
        }

        for(let i = 0; i < routes.length; ++i)
        {
            this.router.use(routes[i], middleware.bind(this));
        }
    }
}

export default Router;