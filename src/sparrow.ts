import path from "path";
import express, { Request, Response } from "express";
import session from "express-session";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import multer from "multer";
import SparrowModel from "./sparrow_model/";
import cors from "cors";

import UsersRouter from "./routes/users/";
import ProfilesRouter from "./routes/profiles/";
import CheepsRouter from "./routes/cheeps/";
import UploadRouter from "./routes/upload/";

dotenv.config();

class Sparrow
{
    private app: express.Application;
    private model: SparrowModel;
    private upload: multer.Multer;

    private usersRouter: UsersRouter;
    private profilesRouter: ProfilesRouter;
    private cheepsRouter: CheepsRouter;
    private uploadRouter: UploadRouter;

    constructor()
    {
        this.app = express();
        this.model = new SparrowModel();

        const storage = multer.memoryStorage();
        this.upload = multer({ storage });

        this.usersRouter = new UsersRouter();
        this.profilesRouter = new ProfilesRouter();
        this.cheepsRouter = new CheepsRouter();
        this.uploadRouter = new UploadRouter(this.upload);
    }

    async start()
    {
        try
        {
            await this.model.initialize();
        }
        catch(err)
        {
            throw err;
        }

        if(process.env.NODE_ENV === "development")
        {
            this.app.use(cors({
                origin: [
                   "http://localhost:3000"
                ],
                credentials: true
            }));
        }

        this.app.use(express.json());
        this.app.use(express.urlencoded({ extended: false }));
        this.app.use(cookieParser(process.env.COOKIE_SECRET));
        this.app.use(session({
            secret: process.env.SESSION_SECRET,
            resave: false,
            saveUninitialized: false
        }));

        this.app.use((req, res, next) =>
        {
            req.model = this.model;

            next();
        });

        this.app.use(express.static(path.join(__dirname, "..", "res")));

        this.app.use("/api/user", this.usersRouter.use());
        this.app.use("/api/profile", this.profilesRouter.use());
        this.app.use("/api/cheep", this.cheepsRouter.use());
        this.app.use("/api/upload", this.uploadRouter.use());

        this.app.get("*", (req : Request, res : Response) => {
            res.sendFile(path.join(__dirname, "..", "res", "build", "index.html"));
        });

        this.app.listen(process.env.PORT, () =>
        {
            console.log(`Server on port ${process.env.PORT}.`);
        });
    }
}

export default Sparrow;