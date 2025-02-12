import {createSlice, PayloadAction} from "@reduxjs/toolkit";

export interface IAuthReducer {
    isAuthorized: boolean;
    userId?: string;
}

export const initialState: IAuthReducer = {
    isAuthorized: false,
}

export const AuthSlice = createSlice({
    name: 'auth',
    initialState,
    reducers: {
        SetAuthorized (state, action: PayloadAction<{ isAuth: boolean; userId?: string; }>){
            state.isAuthorized = action.payload.isAuth;
            state.userId = action.payload.userId;
        },
    }
})

export default AuthSlice.reducer;