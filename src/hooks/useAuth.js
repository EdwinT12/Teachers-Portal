import { createContext, useContext } from "react";

const AuthContext = createContext({
  loading: true,
  session: null,
  user: null,
});

const useAuth = () => {
  return useContext(AuthContext);
};

export { useAuth, AuthContext };
