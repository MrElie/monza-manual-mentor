import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { CarBrand, CarModel, PdfDocument, UserProfile } from "@/types/database";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Upload, Plus, Edit, Trash2, Users, Car, FileText, Settings, Image, Check, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

const AdminPanel = () => {
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);

  // State for data
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [brands, setBrands] = useState<CarBrand[]>([]);
  const [models, setModels] = useState<CarModel[]>([]);
  const [documents, setDocuments] = useState<PdfDocument[]>([]);
  const [logoUrl, setLogoUrl] = useState<string>("");

  // State for forms
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [editingBrand, setEditingBrand] = useState<CarBrand | null>(null);
  const [editingModel, setEditingModel] = useState<CarModel | null>(null);

  // Dialog states
  const [showUserDialog, setShowUserDialog] = useState(false);
  const [showBrandDialog, setShowBrandDialog] = useState(false);
  const [showModelDialog, setShowModelDialog] = useState(false);

  useEffect(() => {
    if (isAdmin) {
      fetchAllData();
    }
  }, [isAdmin]);

  const fetchAllData = async () => {
    try {
      const [usersRes, brandsRes, modelsRes, docsRes, logoRes] = await Promise.all([
        supabase.from('user_profiles').select('*').order('created_at', { ascending: false }),
        supabase.from('car_brands').select('*').order('display_name'),
        supabase.from('car_models').select('*, brand:car_brands(*)').order('display_name'),
        supabase.from('pdf_documents').select('*, model:car_models(display_name)').order('created_at', { ascending: false }),
        supabase.from('app_settings').select('value').eq('key', 'logo_url').single()
      ]);

      if (usersRes.data) setUsers(usersRes.data);
      if (brandsRes.data) setBrands(brandsRes.data);
      if (modelsRes.data) setModels(modelsRes.data);
      if (docsRes.data) setDocuments(docsRes.data);
      if (logoRes.data) setLogoUrl(logoRes.data.value as string);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  // User Management Functions
  const handleCreateUser = async (email: string, role: 'admin' | 'user') => {
    try {
      toast({
        title: "Info",
        description: "User creation from frontend requires server-side implementation. For now, ask users to sign up normally and you can change their role here.",
        variant: "default",
      });
      setShowUserDialog(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create user",
        variant: "destructive",
      });
    }
  };

  const handleUpdateUserRole = async (userId: string, role: 'admin' | 'user') => {
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ role })
        .eq('user_id', userId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "User role updated successfully",
      });

      fetchAllData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update user role",
        variant: "destructive",
      });
    }
  };

  const handleUpdateUserApproval = async (userId: string, approved: boolean) => {
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ approved })
        .eq('user_id', userId);

      if (error) throw error;

      setUsers(users.map(user => 
        user.user_id === userId ? { ...user, approved } : user
      ));

      toast({
        title: "Success",
        description: `User ${approved ? 'approved' : 'rejected'} successfully`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update user approval",
        variant: "destructive",
      });
    }
  };

  // Brand Management Functions
  const handleSaveBrand = async (name: string, displayName: string) => {
    try {
      if (editingBrand) {
        const { error } = await supabase
          .from('car_brands')
          .update({ name, display_name: displayName })
          .eq('id', editingBrand.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('car_brands')
          .insert({ name, display_name: displayName });
        if (error) throw error;
      }

      toast({
        title: "Success",
        description: `Brand ${editingBrand ? 'updated' : 'created'} successfully`,
      });

      fetchAllData();
      setShowBrandDialog(false);
      setEditingBrand(null);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save brand",
        variant: "destructive",
      });
    }
  };

  // Model Management Functions
  const handleSaveModel = async (brandId: string, name: string, displayName: string, imageFile?: File) => {
    try {
      let imageUrl = editingModel?.image_url || null;

      if (imageFile) {
        const fileName = `car-models/${Date.now()}-${imageFile.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('app-assets')
          .upload(fileName, imageFile);

        if (uploadError) throw uploadError;
        imageUrl = `https://ggtgwndgilhnlxcwhtdd.supabase.co/storage/v1/object/public/app-assets/${uploadData.path}`;
      }

      if (editingModel) {
        const { error } = await supabase
          .from('car_models')
          .update({ brand_id: brandId, name, display_name: displayName, image_url: imageUrl })
          .eq('id', editingModel.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('car_models')
          .insert({ brand_id: brandId, name, display_name: displayName, image_url: imageUrl });
        if (error) throw error;
      }

      toast({
        title: "Success",
        description: `Model ${editingModel ? 'updated' : 'created'} successfully`,
      });

      fetchAllData();
      setShowModelDialog(false);
      setEditingModel(null);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save model",
        variant: "destructive",
      });
    }
  };

  // Logo Management
  const handleLogoUpload = async (file: File) => {
    try {
      const fileName = `logos/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('app-assets')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const newLogoUrl = `https://ggtgwndgilhnlxcwhtdd.supabase.co/storage/v1/object/public/app-assets/${uploadData.path}`;

      const { error } = await supabase
        .from('app_settings')
        .update({ value: JSON.stringify(newLogoUrl) })
        .eq('key', 'logo_url');

      if (error) throw error;

      setLogoUrl(newLogoUrl);
      toast({
        title: "Success",
        description: "Logo updated successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to upload logo",
        variant: "destructive",
      });
    }
  };

  // PDF Upload (existing functionality)
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedModel) {
      toast({
        title: "Error",
        description: "Please select a file and car model",
        variant: "destructive",
      });
      return;
    }

    if (file.type !== 'application/pdf') {
      toast({
        title: "Error",
        description: "Only PDF files are allowed",
        variant: "destructive",
      });
      return;
    }

    const MAX_SIZE_BYTES = 256 * 1024 * 1024;
    if (file.size > MAX_SIZE_BYTES) {
      toast({
        title: "File too large",
        description: "Please upload a PDF smaller than 256 MB.",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    
    try {
      const sanitizedFileName = file.name
        .replace(/[[\]{}()*+?.,\\^$|#\s]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');
      
      const fileName = `${selectedModel}/${Date.now()}-${sanitizedFileName}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('repair-manuals')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { error: insertError } = await supabase
        .from('pdf_documents')
        .insert({
          model_id: selectedModel,
          filename: fileName,
          original_filename: file.name,
          file_size: file.size,
          storage_path: uploadData.path,
          uploaded_by: user?.id
        });

      if (insertError) throw insertError;

      toast({
        title: "Success",
        description: "PDF uploaded successfully",
      });

      fetchAllData();
      event.target.value = '';
      setSelectedModel('');
    } catch (error: any) {
      console.error('Upload error:', error);
      const statusCode = error?.statusCode || error?.status || error?.value?.statusCode;
      const message = error?.message || error?.value?.message || 'Failed to upload PDF';

      if (statusCode === 413 || /exceeded the maximum allowed size/i.test(message)) {
        toast({
          title: "File too large",
          description: "Your PDF exceeds the maximum allowed size (256 MB). Please compress it and try again.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: message,
          variant: "destructive",
        });
      }
    } finally {
      setUploading(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-4">Access Denied</h1>
          <p className="text-muted-foreground">You don't have permission to access this page.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading admin panel...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Admin Panel</h1>
            <p className="text-muted-foreground">Manage users, car models, documents, and settings</p>
          </div>
          <Button 
            variant="outline" 
            onClick={() => window.location.href = '/'}
            className="flex items-center gap-2"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            Home
          </Button>
        </div>

        <Tabs defaultValue="users" className="space-y-6">
          <TabsList className="grid w-full md:w-auto grid-cols-2 md:grid-cols-5">
            <TabsTrigger value="users" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Users
            </TabsTrigger>
            <TabsTrigger value="brands" className="flex items-center gap-2">
              <Car className="h-4 w-4" />
              Brands
            </TabsTrigger>
            <TabsTrigger value="models" className="flex items-center gap-2">
              <Car className="h-4 w-4" />
              Models
            </TabsTrigger>
            <TabsTrigger value="documents" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Documents
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Settings
            </TabsTrigger>
          </TabsList>

          {/* Users Tab */}
          <TabsContent value="users">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  User Management
                </CardTitle>
                <Dialog open={showUserDialog} onOpenChange={setShowUserDialog}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      Add User
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create New User</DialogTitle>
                    </DialogHeader>
                    <UserForm onSubmit={handleCreateUser} onCancel={() => setShowUserDialog(false)} />
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {users.map((user) => (
                    <div key={user.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <p className="font-medium">{user.username}</p>
                          <Badge variant={user.approved ? 'default' : 'destructive'}>
                            {user.approved ? 'Approved' : 'Pending'}
                          </Badge>
                          <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                            {user.role}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Created: {new Date(user.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {!user.approved && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleUpdateUserApproval(user.user_id, true)}
                              className="text-green-600 hover:text-green-700"
                            >
                              <Check className="h-4 w-4 mr-1" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleUpdateUserApproval(user.user_id, false)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <X className="h-4 w-4 mr-1" />
                              Reject
                            </Button>
                          </>
                        )}
                        
                        <Select 
                          value={user.role} 
                          onValueChange={(role: 'admin' | 'user') => handleUpdateUserRole(user.user_id, role)}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="user">User</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  ))}
                  
                  {users.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      No users found. Users will appear here after they sign up.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Car Brands Tab */}
          <TabsContent value="brands">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Car Brands</CardTitle>
                <Dialog open={showBrandDialog} onOpenChange={setShowBrandDialog}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Brand
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{editingBrand ? 'Edit' : 'Create'} Brand</DialogTitle>
                    </DialogHeader>
                    <BrandForm 
                      brand={editingBrand} 
                      onSubmit={handleSaveBrand} 
                      onCancel={() => {
                        setShowBrandDialog(false);
                        setEditingBrand(null);
                      }} 
                    />
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4">
                  {brands.map((brand) => (
                    <div key={brand.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <h3 className="font-semibold">{brand.display_name}</h3>
                        <p className="text-sm text-muted-foreground">ID: {brand.name}</p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditingBrand(brand);
                          setShowBrandDialog(true);
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Car Models Tab */}
          <TabsContent value="models">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Car Models</CardTitle>
                <Dialog open={showModelDialog} onOpenChange={setShowModelDialog}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Model
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>{editingModel ? 'Edit' : 'Create'} Car Model</DialogTitle>
                    </DialogHeader>
                    <ModelForm 
                      model={editingModel}
                      brands={brands}
                      onSubmit={handleSaveModel} 
                      onCancel={() => {
                        setShowModelDialog(false);
                        setEditingModel(null);
                      }} 
                    />
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4">
                  {models.map((model) => (
                    <div key={model.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-4">
                        {model.image_url && (
                          <img 
                            src={model.image_url} 
                            alt={model.display_name}
                            className="w-16 h-16 object-cover rounded"
                          />
                        )}
                        <div>
                          <h3 className="font-semibold">{model.display_name}</h3>
                          <p className="text-sm text-muted-foreground">
                            Brand: {model.brand?.display_name} | ID: {model.name}
                          </p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditingModel(model);
                          setShowModelDialog(true);
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Documents Tab */}
          <TabsContent value="documents">
            <Card>
              <CardHeader>
                <CardTitle>PDF Document Management</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <Label htmlFor="model-select">Select Car Model</Label>
                    <Select value={selectedModel} onValueChange={setSelectedModel}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a car model" />
                      </SelectTrigger>
                      <SelectContent>
                        {models.map((model) => (
                          <SelectItem key={model.id} value={model.id}>
                            {model.display_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="pdf-upload">Upload PDF (up to 256 MB)</Label>
                    <Input
                      id="pdf-upload"
                      type="file"
                      accept=".pdf"
                      onChange={handleFileUpload}
                      disabled={uploading || !selectedModel}
                    />
                  </div>
                </div>

                {uploading && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                    Uploading...
                  </div>
                )}

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Uploaded Documents</h3>
                  {documents.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <p className="font-medium">{doc.original_filename}</p>
                        <p className="text-sm text-muted-foreground">
                          Model: {(doc as any).model?.display_name} | Size: {Math.round(doc.file_size / 1024 / 1024)} MB
                        </p>
                      </div>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Document</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete "{doc.original_filename}"? This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction>Delete</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  App Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <Label>Current Logo</Label>
                  <div className="mt-2 mb-4">
                    {logoUrl ? (
                      <img src={logoUrl} alt="Current logo" className="h-16 object-contain" />
                    ) : (
                      <div className="h-16 w-32 bg-muted rounded flex items-center justify-center">
                        <Image className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <Label htmlFor="logo-upload">Upload New Logo</Label>
                  <Input
                    id="logo-upload"
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleLogoUpload(file);
                    }}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

// Form Components
const UserForm = ({ onSubmit, onCancel }: { onSubmit: (email: string, role: 'admin' | 'user') => void, onCancel: () => void }) => {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'admin' | 'user'>('user');

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="email">Email</Label>
        <Input 
          id="email" 
          type="email" 
          value={email} 
          onChange={(e) => setEmail(e.target.value)} 
          placeholder="user@example.com"
        />
      </div>
      <div>
        <Label htmlFor="role">Role</Label>
        <Select value={role} onValueChange={(value: 'admin' | 'user') => setRole(value)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="user">User</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex gap-2 justify-end">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={() => onSubmit(email, role)} disabled={!email}>
          Create User
        </Button>
      </div>
    </div>
  );
};

const BrandForm = ({ brand, onSubmit, onCancel }: { 
  brand: CarBrand | null, 
  onSubmit: (name: string, displayName: string) => void, 
  onCancel: () => void 
}) => {
  const [name, setName] = useState(brand?.name || '');
  const [displayName, setDisplayName] = useState(brand?.display_name || '');

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="name">Brand ID</Label>
        <Input 
          id="name" 
          value={name} 
          onChange={(e) => setName(e.target.value)} 
          placeholder="voyah"
        />
      </div>
      <div>
        <Label htmlFor="displayName">Display Name</Label>
        <Input 
          id="displayName" 
          value={displayName} 
          onChange={(e) => setDisplayName(e.target.value)} 
          placeholder="Voyah"
        />
      </div>
      <div className="flex gap-2 justify-end">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={() => onSubmit(name, displayName)} disabled={!name || !displayName}>
          {brand ? 'Update' : 'Create'} Brand
        </Button>
      </div>
    </div>
  );
};

const ModelForm = ({ model, brands, onSubmit, onCancel }: { 
  model: CarModel | null,
  brands: CarBrand[],
  onSubmit: (brandId: string, name: string, displayName: string, imageFile?: File) => void, 
  onCancel: () => void 
}) => {
  const [brandId, setBrandId] = useState(model?.brand_id || '');
  const [name, setName] = useState(model?.name || '');
  const [displayName, setDisplayName] = useState(model?.display_name || '');
  const [imageFile, setImageFile] = useState<File | undefined>();

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="brandId">Brand</Label>
        <Select value={brandId} onValueChange={setBrandId}>
          <SelectTrigger>
            <SelectValue placeholder="Select a brand" />
          </SelectTrigger>
          <SelectContent>
            {brands.map((brand) => (
              <SelectItem key={brand.id} value={brand.id}>
                {brand.display_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label htmlFor="name">Model ID</Label>
        <Input 
          id="name" 
          value={name} 
          onChange={(e) => setName(e.target.value)} 
          placeholder="courage"
        />
      </div>
      <div>
        <Label htmlFor="displayName">Display Name</Label>
        <Input 
          id="displayName" 
          value={displayName} 
          onChange={(e) => setDisplayName(e.target.value)} 
          placeholder="Voyah Courage"
        />
      </div>
      <div>
        <Label htmlFor="image">Model Image</Label>
        <Input
          id="image"
          type="file"
          accept="image/*"
          onChange={(e) => setImageFile(e.target.files?.[0])}
        />
        {model?.image_url && (
          <div className="mt-2">
            <img src={model.image_url} alt="Current" className="h-20 object-cover rounded" />
          </div>
        )}
      </div>
      <div className="flex gap-2 justify-end">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button 
          onClick={() => onSubmit(brandId, name, displayName, imageFile)} 
          disabled={!brandId || !name || !displayName}
        >
          {model ? 'Update' : 'Create'} Model
        </Button>
      </div>
    </div>
  );
};

export default AdminPanel;