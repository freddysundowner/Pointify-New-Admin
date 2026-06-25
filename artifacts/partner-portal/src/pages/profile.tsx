import { useEffect, useRef } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useGetPortalProfile, getGetPortalProfileQueryKey, useUpdatePortalProfile } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { Loader2, User, Save, Shield } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

const profileSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.string().email("Please enter a valid email").optional().or(z.literal("")),
  phonenumber: z.string().min(8, "Phone number is required"),
  address: z.string().optional().or(z.literal("")),
  country: z.string().min(2, "Country is required"),
});

const passwordSchema = z.object({
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string().min(6, "Confirm password is required"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export default function Profile() {
  const { toast } = useToast();
  const { updateUserdata } = useAuth();
  const queryClient = useQueryClient();
  
  const { data: profile, isLoading } = useGetPortalProfile({
    query: { queryKey: getGetPortalProfileQueryKey() }
  });

  const updateProfileMutation = useUpdatePortalProfile();
  const updatePasswordMutation = useUpdatePortalProfile();

  const profileForm = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: "",
      email: "",
      phonenumber: "",
      address: "",
      country: "Kenya",
    },
  });

  const passwordForm = useForm<z.infer<typeof passwordSchema>>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  const initialized = useRef(false);

  useEffect(() => {
    if (profile && !initialized.current) {
      profileForm.reset({
        name: profile.name || "",
        email: profile.email || "",
        phonenumber: profile.phonenumber || "",
        address: profile.address || "",
        country: profile.country || "Kenya",
      });
      initialized.current = true;
    }
  }, [profile, profileForm]);

  const onProfileSubmit = (values: z.infer<typeof profileSchema>) => {
    updateProfileMutation.mutate({ data: values }, {
      onSuccess: (updatedPartner) => {
        toast({
          title: "Profile Updated",
          description: "Your profile information has been saved.",
        });
        queryClient.setQueryData(getGetPortalProfileQueryKey(), updatedPartner);
        // Sync context
        updateUserdata({
          email: updatedPartner.email,
          phone: updatedPartner.phonenumber,
        });
      },
      onError: (err: any) => {
        toast({
          title: "Update Failed",
          description: err?.data?.message || err?.message || "An error occurred",
          variant: "destructive",
        });
      }
    });
  };

  const onPasswordSubmit = (values: z.infer<typeof passwordSchema>) => {
    updatePasswordMutation.mutate({ data: { password: values.password } }, {
      onSuccess: () => {
        toast({
          title: "Password Updated",
          description: "Your password has been changed successfully.",
        });
        passwordForm.reset({ password: "", confirmPassword: "" });
      },
      onError: (err: any) => {
        toast({
          title: "Update Failed",
          description: err?.data?.message || err?.message || "An error occurred",
          variant: "destructive",
        });
      }
    });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">My Profile</h1>
        <p className="text-muted-foreground mt-1">Manage your account details and security settings.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              Personal Information
            </CardTitle>
            <CardDescription>Update your contact details and location.</CardDescription>
          </CardHeader>
          <Form {...profileForm}>
            <form onSubmit={profileForm.handleSubmit(onProfileSubmit)}>
              <CardContent className="space-y-4">
                <FormField
                  control={profileForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <Label>Full Name</Label>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={profileForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <Label>Email</Label>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={profileForm.control}
                    name="phonenumber"
                    render={({ field }) => (
                      <FormItem>
                        <Label>Phone Number</Label>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={profileForm.control}
                    name="address"
                    render={({ field }) => (
                      <FormItem>
                        <Label>Address</Label>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={profileForm.control}
                    name="country"
                    render={({ field }) => (
                      <FormItem>
                        <Label>Country</Label>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
              <CardFooter className="bg-muted/30 border-t pt-6">
                <Button 
                  type="submit" 
                  disabled={updateProfileMutation.isPending}
                  className="gap-2"
                >
                  {updateProfileMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  Save Changes
                </Button>
              </CardFooter>
            </form>
          </Form>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Security
            </CardTitle>
            <CardDescription>Change your account password.</CardDescription>
          </CardHeader>
          <Form {...passwordForm}>
            <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)}>
              <CardContent className="space-y-4">
                <FormField
                  control={passwordForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <Label>New Password</Label>
                      <FormControl>
                        <Input type="password" {...field} placeholder="••••••••" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={passwordForm.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <Label>Confirm New Password</Label>
                      <FormControl>
                        <Input type="password" {...field} placeholder="••••••••" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
              <CardFooter className="bg-muted/30 border-t pt-6">
                <Button 
                  type="submit" 
                  variant="secondary"
                  disabled={updatePasswordMutation.isPending}
                  className="gap-2"
                >
                  {updatePasswordMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  Update Password
                </Button>
              </CardFooter>
            </form>
          </Form>
        </Card>
      </div>
    </div>
  );
}
