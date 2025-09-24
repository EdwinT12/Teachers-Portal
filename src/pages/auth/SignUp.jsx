import { memo } from "react";
import { useNavigate } from "react-router";
import toast from "react-hot-toast";

import AccountForm from "../../containers/AccountForm";
import supabase from "../../utils/supabase";

const SignUp = () => {
  const navigate = useNavigate();

  const signUp = async (email, password) => {
    const result = await supabase.auth.signUp({
      email,
      password,
    });

    if (result.data.user?.identities?.length === 0) {
      toast.error("Account cannot be created. Please, try again later.");
    } else {
      toast.success(
        "Welcome and please check your inbox to confirm your account!"
      );
      navigate("/");
    }
  };

  return (
    <>
      <h1>Sign Up</h1>
      <AccountForm onSubmit={signUp} />
    </>
  );
};

export default memo(SignUp);
