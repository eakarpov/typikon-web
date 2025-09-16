import {createSlice, PayloadAction} from "@reduxjs/toolkit";

export interface IAuthReducer {
    isAuthorized: boolean;
    userId?: string;
    user?: any;
    cookieExpiresAt?: number;
}

export const initialState: IAuthReducer = {
    isAuthorized: false,
}

export const AuthSlice = createSlice({
    name: 'auth',
    initialState,
    reducers: {
        SetAuthorized (
            state,
            action: PayloadAction<{ isAuth: boolean; userId?: string; expiresAt?: number; user?: any }>
        ){
            state.isAuthorized = action.payload.isAuth;
            state.userId = action.payload.userId;
            state.cookieExpiresAt = action.payload.expiresAt;
            state.user = action.payload.user;
        },
        Logout (state){
            state.isAuthorized = false;
            state.userId = undefined;
            state.cookieExpiresAt = undefined;
            state.user = undefined;
        },
    }
})

export default AuthSlice.reducer;