import { asyncHandler } from "../utils/asyncHandler.js";
import { apiError } from "../utils/apiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js"
import { apiResponse } from "../utils/apiResponse.js"

const registerUser = asyncHandler(async (req, res) => {
    /* 
    --- ALGORITHM TO FOLLOW IN ORDER TO BUILD THE USER REGISTRATION LOGIC --- 
        1. get user details
        2. validation
        3. check if user already exists: using email or username
        4. check for coverimage and avatar(required)
        5. upload them to cloudinary, check for avatar again
        6. make user object - create entry in db
        7. remove password and refresh token from response
        8. check if user is created successfully
        9. return the res
    */

    // LOGIC
    // 1. Destructuring
    const { fullName, username, password, email } = req.body;
    // console.log(email);  tested output by giving JSON input from postman

    // 2. Validations
    if ([fullName, username, password, email].some((field) =>
        field?.trim() === "") // checks if atleast one field is empty of not if yes throw error
    ) {
        throw new apiError(400, "All fields are required...");
    }
    // 3. Check for Existing User
    const existedUser = await User.findOne({
        $or: [{ username }, { email }]
    })
    if (existedUser) {
        throw new apiError(409, "Username or Email Already Exists")
    }

    // 4. Check for Cover and Avatar images using the multer middleware which will be saved in the ../public/temp folder before uploading on cloudinary
    const avatarLocalPath = req.files?.avatar && req.files.avatar.length > 0 
    ? req.files.avatar[0].path 
    : null;
    let coverImageLocalPath; // checking coverimage exists or not, the above method is not working as it is working for avatar
    if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
        coverImageLocalPath = req.files.coverImage[0].path
    }

    // 5.1 Special Check on Avatar image
    if (!avatarLocalPath) {
        throw new apiError(400, "Avatar image is required")
    }

    // 5.2 Upload on Cloudinary
    const avatar = await uploadOnCloudinary(avatarLocalPath) // await bcs it takes time to upload
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)
    if (!avatar) {
        throw new apiError(400, "Avatar image is required")
    }
    // 6. Make user object and creating entry in DB
    const user = await User.create({
        // _id made by mongodb itself
        fullName,
        username: username.toLowerCase(),
        avatar: avatar.url,
        coverImage: coverImage?.url || "", // bcs user might not have given the cover image
        email,
        password
    })
    // 7. 8. Check of user is created and remove password and refreshToken for showing response
    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )
    if (!createdUser) {
        throw new apiError(500, "Something went wrong while registering the user")
    }
    // 9. Response using apiResponse
    return res.status(201).json(
        new apiResponse(200, createdUser, "Successfully Registered the user")
    )
})

export { registerUser }