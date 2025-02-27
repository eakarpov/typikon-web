import {createSlice, PayloadAction} from "@reduxjs/toolkit";

export interface IAuthReducer {
    isAuthorized: boolean;
    userId?: string;
    cookieExpiresAt?: number;
}

export const initialState: IAuthReducer = {
    isAuthorized: false,
}

export const AuthSlice = createSlice({
    name: 'auth',
    initialState,
    reducers: {
        SetAuthorized (state, action: PayloadAction<{ isAuth: boolean; userId?: string; expiresAt?: number; }>){
            state.isAuthorized = action.payload.isAuth;
            state.userId = action.payload.userId;
            state.cookieExpiresAt = action.payload.expiresAt;
        },
        Logout (state){
            state.isAuthorized = false;
            state.userId = undefined;
            state.cookieExpiresAt = undefined;
        },
    }
})

export default AuthSlice.reducer;