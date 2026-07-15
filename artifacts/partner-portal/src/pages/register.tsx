import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useSearch } from "wouter";
import { usePortalRegister } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Loader2 } from "lucide-react";

const formSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.string().email("Please enter a valid email"),
  phonenumber: z.string().min(8, "Phone number is required"),
  country: z.string().min(2, "Country is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export default function Register() {
  const { login } = useAuth();
  const { toast } = useToast();
  const registerMutation = usePortalRegister();
  const search = useSearch();
  const ref = new URLSearchParams(search).get("ref")?.trim() || "";

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", email: "", phonenumber: "", country: "Kenya", password: "" },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    registerMutation.mutate({ data: ref ? { ...values, ref } : values }, {
      onSuccess: (res) => {
        if (res.token && res.userdata) {
          if (ref && res.refApplied === false) {
            toast({
              title: "Invite link could not be applied",
              description:
                "Your account was created, but it was not linked to the partner who invited you. Please ask them to add you from their Sub-partners page.",
              variant: "destructive",
            });
          }
          login(res.token, res.userdata as any);
        } else {
          toast({
            title: "Registration failed",
            description: res.message || "Could not complete registration",
            variant: "destructive",
          });
        }
      },
      onError: (err: any) => {
        toast({
          title: "Registration failed",
          description: err?.data?.message || err?.message || "An error occurred",
          variant: "destructive",
        });
      }
    });
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-muted/30 p-4 py-12">
      <Card className="w-full max-w-md shadow-xl border-border/50">
        <CardHeader className="space-y-3 text-center pb-6">
          <div className="mx-auto w-12 h-12 bg-primary rounded-xl flex items-center justify-center text-primary-foreground font-bold text-xl mb-2 shadow-sm">
            P
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">Become a Partner</CardTitle>
          <CardDescription className="text-base">
            Earn commissions by referring shops to Pointify POS
          </CardDescription>
          {ref && (
            <div className="mx-auto rounded-lg bg-primary/10 px-4 py-2 text-sm font-medium text-primary">
              You're joining through a partner invite link — your account will
              be connected to their team.
            </div>
          )}
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <Label>Full Name</Label>
                    <FormControl>
                      <Input placeholder="John Doe" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <Label>Email address</Label>
                    <FormControl>
                      <Input placeholder="partner@example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="phonenumber"
                  render={({ field }) => (
                    <FormItem>
                      <Label>Phone Number</Label>
                      <FormControl>
                        <Input placeholder="254700000000" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="country"
                  render={({ field }) => (
                    <FormItem>
                      <Label>Country</Label>
                      <FormControl>
                        <Input placeholder="Kenya" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <Label>Password</Label>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button 
                type="submit" 
                className="w-full h-11 text-base mt-2" 
                disabled={registerMutation.isPending}
              >
                {registerMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "Create Account"}
              </Button>
            </form>
          </Form>
        </CardContent>
        <CardFooter className="flex justify-center border-t py-6 bg-muted/20">
          <p className="text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="text-primary font-semibold hover:underline">
              Sign in here
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
