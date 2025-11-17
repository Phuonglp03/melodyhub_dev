import { configureStore } from "@reduxjs/toolkit";
import authReducer from "./authSlice";
import likesReducer from "./likesSlice";
import { persistStore, persistReducer } from "redux-persist";
import storage from "redux-persist/lib/storage";

// Cấu hình persist
const authPersistConfig = {
  key: "auth",
  storage,
};

const persistedAuthReducer = persistReducer(authPersistConfig, authReducer);

// Tạo store với Redux Toolkit
export const store = configureStore({
  reducer: {
    auth: persistedAuthReducer,
    likes: likesReducer,
    // Thêm các reducer khác nếu cần
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false, // Disable serializable check for non-serializable values like functions
    }),
});

// Tạo persistor
export const persistor = persistStore(store);
