import NewCheepForm from "../../routes/cheeps/new_cheep_form";
import EditProfileForm from "../../routes/profiles/edit_profile_form";
import CreateUserForm from "../../routes/users/create_user_form";
import LoginForm from "../../routes/users/login_form";
import SparrowModel from "../../sparrow_model/";
import SearchUsersForm from "../../routes/users/search_users_form";

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
            searchUsersForm: SearchUsersForm;
        }
    }
}