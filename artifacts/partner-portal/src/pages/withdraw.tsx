import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { 
  useGetPortalSummary, 
  getGetPortalSummaryQueryKey,
  useRequestPortalWithdrawal,
  getListPortalTransactionsQueryKey
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { formatKES } from "@/lib/format";
import { Banknote, Loader2, Wallet, Info } from "lucide-react";

const formSchema = z.object({
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  phonenumber: z.string().min(9, "Phone number is required"),
});

export default function Withdraw() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: summary, isLoading: summaryLoading } = useGetPortalSummary({
    query: { queryKey: getGetPortalSummaryQueryKey() }
  });

  const withdrawMutation = useRequestPortalWithdrawal();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { amount: 0, phonenumber: "" },
  });

  const walletBalance = summary?.wallet || 0;

  const setMaxAmount = () => {
    form.setValue("amount", walletBalance);
  };

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    if (values.amount > walletBalance) {
      form.setError("amount", { message: "Insufficient funds" });
      return;
    }

    withdrawMutation.mutate({ data: values }, {
      onSuccess: (res) => {
        if (res.status) {
          toast({
            title: "Withdrawal Requested",
            description: "Your withdrawal request has been submitted successfully.",
          });
          form.reset({ amount: 0, phonenumber: values.phonenumber });
          // Invalidate caches to refresh data
          queryClient.invalidateQueries({ queryKey: getGetPortalSummaryQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListPortalTransactionsQueryKey() });
        } else {
          toast({
            title: "Withdrawal Failed",
            description: res.message || "Could not process withdrawal",
            variant: "destructive",
          });
        }
      },
      onError: (err: any) => {
        toast({
          title: "Error",
          description: err?.data?.message || err?.message || "An error occurred",
          variant: "destructive",
        });
      }
    });
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Withdraw Funds</h1>
        <p className="text-muted-foreground mt-1">Transfer your earnings directly to your M-Pesa account.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-primary/20 shadow-md">
          <CardHeader className="bg-primary/5 pb-4">
            <CardTitle className="flex items-center gap-2 text-primary">
              <Wallet className="w-5 h-5" />
              Available Balance
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            {summaryLoading ? (
              <div className="h-10 w-32 bg-muted animate-pulse rounded-md"></div>
            ) : (
              <div>
                <div className="text-4xl font-bold text-foreground">
                  {formatKES(walletBalance)}
                </div>
                {summary?.pendingWithdrawals ? (
                  <p className="text-sm text-amber-600 mt-2 flex items-center gap-1 font-medium">
                    <Info className="w-4 h-4" />
                    {formatKES(summary.pendingWithdrawals)} pending withdrawal
                  </p>
                ) : null}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Request Payout</CardTitle>
            <CardDescription>Enter details to receive your funds via M-Pesa.</CardDescription>
          </CardHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="phonenumber"
                  render={({ field }) => (
                    <FormItem>
                      <Label>M-Pesa Phone Number</Label>
                      <FormControl>
                        <Input placeholder="e.g. 254712345678" {...field} />
                      </FormControl>
                      <FormDescription>The number that will receive the funds</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex justify-between items-center mb-1">
                        <Label>Amount (KES)</Label>
                        <button 
                          type="button" 
                          onClick={setMaxAmount}
                          className="text-xs text-primary font-medium hover:underline"
                        >
                          Max: {formatKES(walletBalance)}
                        </button>
                      </div>
                      <FormControl>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                            KES
                          </span>
                          <Input 
                            type="number" 
                            className="pl-12" 
                            placeholder="0" 
                            {...field} 
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
              <CardFooter className="bg-muted/30 border-t pt-6">
                <Button 
                  type="submit" 
                  className="w-full h-11 text-base gap-2" 
                  disabled={withdrawMutation.isPending || walletBalance <= 0}
                >
                  {withdrawMutation.isPending ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <Banknote className="w-5 h-5" />
                      Request Withdrawal
                    </>
                  )}
                </Button>
              </CardFooter>
            </form>
          </Form>
        </Card>
      </div>
    </div>
  );
}
