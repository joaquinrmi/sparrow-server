import CreateUserForm from "../../routes/users/create_user_form";
import SparrowModel from "../../sparrow_model/";

declare global
{
    namespace Express
    {
        interface Request
        {
            model: SparrowModel;
            newUserForm: CreateUserForm;
        }
    }
}