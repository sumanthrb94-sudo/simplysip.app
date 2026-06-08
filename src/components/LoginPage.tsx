import GoogleLoginButton from './GoogleLoginButton';

interface LoginPageProps {
  onLoginSuccess: (user: any) => void;
}

const LoginPage = ({ onLoginSuccess }: LoginPageProps) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#F5F2ED]">
      <div className="text-center mb-8 flex flex-col items-center">
        <img
          src="/images/logo-hero.png"
          alt="SimplySip Elixirs"
          width={480}
          height={640}
          className="h-44 w-auto rounded-3xl ring-1 ring-black/10 shadow-xl mb-6"
        />
        <p className="text-lg text-[#6B4F4B] mt-2">Your daily dose of happiness, just a sip away.</p>
      </div>
      <div className="mt-8">
        <GoogleLoginButton onLoginSuccess={onLoginSuccess} />
      </div>
    </div>
  );
};

export default LoginPage;
