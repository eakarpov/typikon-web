import {createSlice, PayloadAction} from "@reduxjs/toolkit";

export interface IAuthReducer {
    isAuthorized: boolean;
    // Сессия приходит отдельным запросом с клиента, поэтому до ответа состояние
    // «не авторизован» и «ещё не знаем» нужно различать — иначе меню моргает
    // кнопкой «Войти» у залогиненных.
    isResolved: boolean;
    userId?: string;
    user?: any;
    cookieExpiresAt?: number | string;
    /** Чем вошли: "Google", "Telegram", "Yandex". Нужен только для показа. */
    provider?: string;
}

export const initialState: IAuthReducer = {
    isAuthorized: false,
    isResolved: false,
}

export const AuthSlice = createSlice({
    name: 'auth',
    initialState,
    reducers: {
        SetAuthorized (
            state,
            action: PayloadAction<{
                isAuth: boolean;
                userId?: string;
                expiresAt?: number | string;
                user?: any;
                provider?: string;
            }>
        ){
            state.isAuthorized = action.payload.isAuth;
            state.isResolved = true;
            state.userId = action.payload.userId;
            state.cookieExpiresAt = action.payload.expiresAt;
            state.user = action.payload.user;
            state.provider = action.payload.provider;
        },
        // Продление двигает только срок: кто вошёл и что о нём известно, от
        // сдвига окна не меняется, а переписывать всё состояние целиком значило
        // бы гасить уже загруженные данные пользователя.
        Prolonged (state, action: PayloadAction<number | string>){
            state.cookieExpiresAt = action.payload;
        },
        SetResolved (state){
            state.isResolved = true;
        },
        Logout (state){
            state.isAuthorized = false;
            state.isResolved = true;
            state.userId = undefined;
            state.cookieExpiresAt = undefined;
            state.user = undefined;
            state.provider = undefined;
        },
    }
})

export default AuthSlice.reducer;