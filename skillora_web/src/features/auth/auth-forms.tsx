"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, authApi } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import type { AuthResponse } from "@/lib/types";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const registerSchema = z
  .object({
    fullName: z.string().min(2, "Full name is required"),
    email: z.string().email(),
    password: z.string().min(8, "Use at least 8 characters"),
    role: z.enum(["STUDENT", "INSTRUCTOR"]),
    instructorTitle: z.string().optional(),
    instructorExpertise: z.string().optional(),
  })
  .refine((data) => data.role === "STUDENT" || Boolean(data.instructorTitle?.trim()), {
    message: "Instructor title is required",
    path: ["instructorTitle"],
  });

const forgotSchema = z.object({
  email: z.string().email(),
});

const resetSchema = z.object({
  token: z.string().min(10, "Reset token is required"),
  password: z.string().min(8, "Use at least 8 characters"),
});

function roleHome(auth: AuthResponse) {
  if (auth.user.roles.includes("ADMIN")) {
    return "/admin";
  }
  if (auth.user.roles.includes("INSTRUCTOR")) {
    return "/instructor";
  }
  return "/dashboard";
}

function errorMessage(error: unknown) {
  if (error instanceof ApiError) {
    return error.errors?.[0] ?? error.message;
  }
  return "Request failed. Please try again.";
}

const subscribeToClient = () => () => {};

function useFormReady() {
  return React.useSyncExternalStore(subscribeToClient, () => true, () => false);
}

export function LoginForm({ next }: { next?: string }) {
  const ready = useFormReady();
  const router = useRouter();
  const queryClient = useQueryClient();
  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const mutation = useMutation({
    mutationFn: (values: z.infer<typeof loginSchema>) => authApi.login(values),
    onSuccess: (auth) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.me });
      toast.success("Welcome back");
      router.push(next || roleHome(auth));
    },
  });

  return (
    <form method="post" className="space-y-4" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
      <fieldset disabled={!ready} className="space-y-4">
      {mutation.isError ? <Alert variant="destructive"><AlertDescription>{errorMessage(mutation.error)}</AlertDescription></Alert> : null}
      <div className="grid gap-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" autoComplete="email" {...form.register("email")} />
        {form.formState.errors.email ? <p className="text-sm text-destructive">{form.formState.errors.email.message}</p> : null}
      </div>
      <div className="grid gap-2">
        <Label htmlFor="password">Password</Label>
        <Input id="password" type="password" autoComplete="current-password" {...form.register("password")} />
        {form.formState.errors.password ? <p className="text-sm text-destructive">{form.formState.errors.password.message}</p> : null}
      </div>
      <div className="flex items-center justify-between text-sm">
        <Link href="/forgot-password" className="text-primary hover:underline">
          Forgot password
        </Link>
      </div>
      <Button type="submit" className="w-full" disabled={!ready || mutation.isPending}>
        {mutation.isPending ? "Signing in" : "Sign in"}
      </Button>
      </fieldset>
    </form>
  );
}

export function RegisterForm() {
  const ready = useFormReady();
  const router = useRouter();
  const queryClient = useQueryClient();
  const form = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      fullName: "",
      email: "",
      password: "",
      role: "STUDENT",
      instructorTitle: "",
      instructorExpertise: "",
    },
  });
  const role = useWatch({ control: form.control, name: "role" }) ?? "STUDENT";

  const mutation = useMutation({
    mutationFn: (values: z.infer<typeof registerSchema>) => authApi.register(values),
    onSuccess: (auth) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.me });
      toast.success("Account created");
      router.push(roleHome(auth));
    },
  });

  return (
    <form method="post" className="space-y-4" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
      <fieldset disabled={!ready} className="space-y-4">
      {mutation.isError ? <Alert variant="destructive"><AlertDescription>{errorMessage(mutation.error)}</AlertDescription></Alert> : null}
      <div className="grid gap-2">
        <Label htmlFor="fullName">Full name</Label>
        <Input id="fullName" autoComplete="name" {...form.register("fullName")} />
        {form.formState.errors.fullName ? <p className="text-sm text-destructive">{form.formState.errors.fullName.message}</p> : null}
      </div>
      <div className="grid gap-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" autoComplete="email" {...form.register("email")} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="password">Password</Label>
        <Input id="password" type="password" autoComplete="new-password" {...form.register("password")} />
        {form.formState.errors.password ? <p className="text-sm text-destructive">{form.formState.errors.password.message}</p> : null}
      </div>
      <div className="grid gap-2">
        <Label>Role</Label>
        <Select value={role} onValueChange={(value) => form.setValue("role", value as "STUDENT" | "INSTRUCTOR")}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="STUDENT">Learner</SelectItem>
            <SelectItem value="INSTRUCTOR">Instructor</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {role === "INSTRUCTOR" ? (
        <>
          <div className="grid gap-2">
            <Label htmlFor="instructorTitle">Instructor title</Label>
            <Input id="instructorTitle" {...form.register("instructorTitle")} />
            {form.formState.errors.instructorTitle ? <p className="text-sm text-destructive">{form.formState.errors.instructorTitle.message}</p> : null}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="instructorExpertise">Expertise</Label>
            <Textarea id="instructorExpertise" rows={3} {...form.register("instructorExpertise")} />
          </div>
        </>
      ) : null}
      <Button type="submit" className="w-full" disabled={!ready || mutation.isPending}>
        {mutation.isPending ? "Creating account" : "Create account"}
      </Button>
      </fieldset>
    </form>
  );
}

export function ForgotPasswordForm() {
  const ready = useFormReady();
  const [resetToken, setResetToken] = React.useState<string | null>(null);
  const form = useForm<z.infer<typeof forgotSchema>>({
    resolver: zodResolver(forgotSchema),
    defaultValues: { email: "" },
  });
  const mutation = useMutation({
    mutationFn: (values: z.infer<typeof forgotSchema>) => authApi.forgotPassword(values.email),
    onSuccess: (data) => {
      toast.success("Reset request sent");
      setResetToken(data?.resetToken ?? null);
    },
  });

  return (
    <form method="post" className="space-y-4" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
      <fieldset disabled={!ready} className="space-y-4">
      {mutation.isError ? <Alert variant="destructive"><AlertDescription>{errorMessage(mutation.error)}</AlertDescription></Alert> : null}
      {mutation.isSuccess ? (
        <Alert>
          <AlertDescription>
            If the email exists, the reset link has been issued.
            {resetToken ? <span className="mt-2 block break-all font-mono text-xs">Dev token: {resetToken}</span> : null}
          </AlertDescription>
        </Alert>
      ) : null}
      <div className="grid gap-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" autoComplete="email" {...form.register("email")} />
      </div>
      <Button type="submit" className="w-full" disabled={!ready || mutation.isPending}>
        {mutation.isPending ? "Sending" : "Send reset link"}
      </Button>
      </fieldset>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token?: string }) {
  const ready = useFormReady();
  const router = useRouter();
  const form = useForm<z.infer<typeof resetSchema>>({
    resolver: zodResolver(resetSchema),
    defaultValues: { token: token ?? "", password: "" },
  });
  const mutation = useMutation({
    mutationFn: (values: z.infer<typeof resetSchema>) => authApi.resetPassword(values),
    onSuccess: () => {
      toast.success("Password reset");
      router.push("/login");
    },
  });

  return (
    <form method="post" className="space-y-4" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
      <fieldset disabled={!ready} className="space-y-4">
      {mutation.isError ? <Alert variant="destructive"><AlertDescription>{errorMessage(mutation.error)}</AlertDescription></Alert> : null}
      <div className="grid gap-2">
        <Label htmlFor="token">Reset token</Label>
        <Input id="token" autoComplete="one-time-code" {...form.register("token")} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="password">New password</Label>
        <Input id="password" type="password" autoComplete="new-password" {...form.register("password")} />
      </div>
      <Button type="submit" className="w-full" disabled={!ready || mutation.isPending}>
        {mutation.isPending ? "Resetting" : "Reset password"}
      </Button>
      </fieldset>
    </form>
  );
}
