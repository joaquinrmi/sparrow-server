enum ErrorType
{
    InternalServerError = "Internal Server Error",
    InvalidQuery = "Invalid Query",
    InvalidForm = "Invalid Form",
    HandleAlreadyExists = "Username Already Exists",
    EmailAlreadyExists = "Email Already Exists",
    ProfileNotFound = "Profile Not Found",
    IncorrectUsernameOrPassword = "Incorrect Username Or Password"
}

export default ErrorType;