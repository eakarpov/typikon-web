declare global {
    // Note the capital "W"
    interface Window {
        handleCredentialResponse: (res: any) => Promise<void>;
    }
}