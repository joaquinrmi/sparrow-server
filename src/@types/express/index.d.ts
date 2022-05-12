import NewCheepForm from "../../routes/cheeps/new_cheep_form";
import EditProfileForm from "../../routes/profiles/edit_profile_form";
import CreateUserForm from "../../routes/users/create_user_form";
import LoginForm from "../../routes/users/login_form";
import SparrowModel from "../../sparrow_model/";

declare global
{
    namespace Express
    {
        interface Request
        {
            model: SparrowModel;
            newUserForm: CreateUserForm;
            loginForm: LoginForm;
            newCheepForm: NewCheepForm;
            editProfileForm: EditProfileForm;
        }
    }
}