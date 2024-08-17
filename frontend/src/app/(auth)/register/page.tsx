import RegisterForm from '@/components/RegisterForm';

export default function RegisterPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-4">Register</h1>
      <RegisterForm />
    </div>
  );
}