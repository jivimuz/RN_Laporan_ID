import * as SecureStore from 'expo-secure-store';

const USER_NAME_KEY = 'user_name';

export const getUserName = async (): Promise<string | null> => {
  try {
    return await SecureStore.getItemAsync(USER_NAME_KEY);
  } catch {
    return null;
  }
};

export const saveUserName = async (name: string): Promise<void> => {
  await SecureStore.setItemAsync(USER_NAME_KEY, name);
};

export const deleteUserName = async (): Promise<void> => {
  await SecureStore.deleteItemAsync(USER_NAME_KEY);
};
