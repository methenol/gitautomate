'use client';

import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { AnimatePresence, motion } from 'framer-motion';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import {
  runGenerateArchitecture,
  runGenerateTasks,
  runResearchTask,
  runGenerateFileStructure,
  runUnifiedOrchestrator,
  getModels,
} from './actions';
import type { Task } from '@/types';
import {
  getRepositories,
  createImplementationPlanIssues,
} from './github-actions';
import type { Repository } from './github-actions';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import {
  Bot,
  ChevronRight,
  FileText,
  Github,
  ListChecks,
  LoaderCircle,
  Settings,
  Wrench,
  CheckCircle2,
  ExternalLink,
  FilePenLine,
  Download,
  ServerOff,
  KeyRound,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import { Logo } from '@/components/logo';
import { Label } from '@/components/ui/label';

const settingsSchema = z.object({
  githubToken: z.string().optional(),
  googleApiKey: z.string().optional(),
  model: z.string(),
  useTDD: z.boolean().default(false),
});

type SettingsFormValues = z.infer<typeof settingsSchema>;

type LoadingStates = {
  repos: boolean;
  arch: boolean;
  tasks: boolean;
  researching: boolean;
  issue: boolean;
  exporting: boolean;
  models: boolean;
  unified: boolean; // New loading state for unified orchestrator
};

type TaskLoadingStates = {
  [taskTitle: string]: boolean;
};


const LOCAL_MODE_REPO_ID = 'local-mode';
const LOCAL_MODE_REPO: Repository = {
  owner: '',
  name: 'Local Mode (Export Only)',
  full_name: LOCAL_MODE_REPO_ID,
};
const UI_DEFAULT_MODEL = 'gemini-1.5-flash-latest';

export default function Home() {
  const { toast } = useToast();
  const [githubToken, setGithubToken] = useState<string>('');
  const [googleApiKey, setGoogleApiKey] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<string>(UI_DEFAULT_MODEL);
  const [useTDD, setUseTDD] = useState<boolean>(false);
  const [useUnifiedWorkflow, setUseUnifiedWorkflow] = useState<boolean>(true);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [repositories, setRepositories] = useState<Repository[]>([LOCAL_MODE_REPO]);
  const [selectedRepo, setSelectedRepo] = useState<string>(LOCAL_MODE_REPO_ID);
  const [prd, setPrd] = useState<string>('');
  const [architecture, setArchitecture] = useState<string>('');
  const [specifications, setSpecifications] = useState<string>('');
  const [fileStructure, setFileStructure] = useState<string>('');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [finalIssueURL, setFinalIssueURL] = useState('');

  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [editedTaskDetails, setEditedTaskDetails] = useState('');
  const [isTaskDetailOpen, setIsTaskDetailOpen] = useState(false);
  const [researchProgress, setResearchProgress] = useState(0);

  const [loading, setLoading] = useState<LoadingStates>({
    repos: false,
    arch: false,
    tasks: false,
    researching: false,
    issue: false,
    exporting: false,
    models: false,
    unified: false, // New loading state for unified orchestrator
  });
  
  const [taskLoading, setTaskLoading] = useState<TaskLoadingStates>({});

  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      githubToken: '',
      googleApiKey: '',
      model: UI_DEFAULT_MODEL,
      useTDD: false,
    },
  });

  const fetchModels = useCallback(async (apiKey?: string) => {
    setLoading((prev) => ({ ...prev, models: true }));
    try {
      const models = await getModels({ apiKey: apiKey || undefined });
      setAvailableModels(models);
      
      if (models.length > 0) {
        const currentModel = localStorage.getItem('selectedModel') || UI_DEFAULT_MODEL;
        if (models.includes(currentModel)) {
          form.setValue('model', currentModel);
          setSelectedModel(currentModel);
        } else {
          form.setValue('model', models[0]);
          setSelectedModel(models[0]);
          localStorage.setItem('selectedModel', models[0]);
        }
      } else {
         toast({
          variant: 'destructive',
          title: 'No Models Found',
          description: "Could not find any models. Check your API key in settings or the .env file.",
        });
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error Fetching Models',
        description: (error as Error).message || "An unknown error occurred.",
      });
      setAvailableModels([]);
    } finally {
      setLoading((prev) => ({ ...prev, models: false }));
    }
  }, [form, toast]);


  useEffect(() => {
    const storedToken = localStorage.getItem('githubToken') || '';
    const storedApiKey = localStorage.getItem('googleApiKey') || '';
    const storedModel = localStorage.getItem('selectedModel') || UI_DEFAULT_MODEL;
    const storedTDD = localStorage.getItem('useTDD') === 'true';

    setGithubToken(storedToken);
    setGoogleApiKey(storedApiKey);
    setSelectedModel(storedModel);
    setUseTDD(storedTDD);

    form.setValue('githubToken', storedToken);
    form.setValue('googleApiKey', storedApiKey);
    form.setValue('model', storedModel);
    form.setValue('useTDD', storedTDD);
    
    if (storedApiKey || process.env.GOOGLE_API_KEY) {
      fetchModels(storedApiKey);
    }
  }, [fetchModels, form]);


  useEffect(() => {
    if (githubToken) {
      const fetchRepos = async () => {
        setLoading((prev) => ({ ...prev, repos: true }));
        try {
          const repos = await getRepositories(githubToken);
          setRepositories([LOCAL_MODE_REPO, ...repos]);
        } catch (error) {
          toast({
            variant: 'destructive',
            title: 'Error',
            description: (error as Error).message,
          });
          setRepositories([LOCAL_MODE_REPO]);
        } finally {
          setLoading((prev) => ({ ...prev, repos: false }));
        }
      };
      fetchRepos();
    } else {
        setRepositories([LOCAL_MODE_REPO]);
    }
  }, [githubToken, toast]);

  const handleSaveSettings = (values: SettingsFormValues) => {
    const oldApiKey = googleApiKey;
    const newApiKey = values.googleApiKey || '';
    
    setGithubToken(values.githubToken || '');
    localStorage.setItem('githubToken', values.githubToken || '');
    
    setGoogleApiKey(newApiKey);
    localStorage.setItem('googleApiKey', newApiKey);

    setSelectedModel(values.model);
    localStorage.setItem('selectedModel', values.model);

    setUseTDD(values.useTDD);
    localStorage.setItem('useTDD', values.useTDD.toString());
    
    setIsSettingsOpen(false);
    toast({ title: 'Success', description: 'Settings saved.' });

    if (newApiKey !== oldApiKey) {
      fetchModels(newApiKey);
    }
  };

  // NEW: Unified orchestrator handler - COMPLETE REPLACEMENT for the old siloed workflow
  const handleGenerateUnifiedProject = async () => {
    setLoading((prev) => ({ ...prev, unified: true }));
    
    try {
      console.log('🚀 Starting unified project generation...');
      
      const result = await runUnifiedOrchestrator(
        {
          prd,
          // Let the orchestrator generate these components automatically
          generateArchitecture: true,
          generateFileStructure: true, 
          
          // Configuration options
          useTDD,
          optimizationStrategy: 'sequential' as const, // Can be changed by user preference
          
          // Validation enabled with reasonable limits - this triggers the two-phase workflow
          enableValidation: true,
          maxIterations: 3
        },
        { apiKey: googleApiKey, model: selectedModel }
      );
      
      console.log('✅ Unified orchestrator completed with project context');
      
      // Update the UI with the generated plans (editable by user)
      setArchitecture(result.projectContext.architecture);
      setSpecifications(result.projectContext.specifications);
      setFileStructure(result.projectContext.fileStructure);
      
      // If there are tasks, they were already generated
      if (result.tasks.length > 0) {
        const legacyTasks = result.tasks.map((task: any) => ({
          title: task.title,
          details: task.details
        }));
        
        setTasks(legacyTasks);
        toast({
          title: '🎉 Project Generation Complete!',
          description: `Generated ${result.tasks.length} tasks with full dependency analysis and validation.`,
        });
      } else {
        // Show message about reviewing plans before generating tasks
        toast({
          title: '📋 Project Plans Generated!',
          description: `Please review and edit the architecture, specifications, and file structure below. Then click "Generate Tasks" to create detailed implementation tasks.`,
        });
      }
      
    } catch (error) {
      console.error('❌ Unified orchestrator error:', error);
      
      toast({
        variant: 'destructive',
        title: 'Project Generation Failed',
        description: (error as Error).message || 'The unified orchestrator encountered an error. Please try again.',
      });
      
    } finally {
      setLoading((prev) => ({ ...prev, unified: false }));
    }
  };

  // NEW: Generate tasks after user approves the plans
  const handleGenerateTasksAfterApproval = async () => {
    setLoading((prev) => ({ ...prev, tasks: true }));
    
    try {
      console.log('🚀 Generating tasks after user approval...');
      
      // Use the current architecture, specifications, and file structure (which may have been edited)
      const result = await runUnifiedOrchestrator(
        {
          prd,
          architecture: architecture || undefined, // Use user-edited version if available
          specifications: specifications || undefined,
          fileStructure: fileStructure || undefined,
          
          // Configuration options
          generateArchitecture: false, // Don't regenerate - user has already reviewed plans
          generateFileStructure: false,
          useTDD,
          optimizationStrategy: 'sequential' as const,
          
          // Don't enable validation for this phase - we want to generate tasks directly
          enableValidation: false,
          maxIterations: 3
        },
        { apiKey: googleApiKey, model: selectedModel }
      );
      
      console.log('✅ Tasks generated successfully');
      toast({
        title: '🎉 Task Generation Complete!',
        description: `Generated ${result.tasks.length} tasks with full dependency analysis and validation.`,
      });
      
      // Convert unified tasks to legacy Task format for compatibility
      const legacyTasks = result.tasks.map((task: any) => ({
        title: task.title,
        details: task.details
      }));
      
      setTasks(legacyTasks);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Task Generation Failed',
        description: (error as Error).message,
      });
    } finally {
      setLoading((prev) => ({ ...prev, tasks: false }));
    }
  };

  // LEGACY: Old architecture handler - kept for fallback compatibility
  const handleGenerateArchitecture = async () => {
    setLoading((prev) => ({ ...prev, arch: true }));
    setArchitecture('');
    setSpecifications('');
    setFileStructure('');
    setTasks([]);
    setFinalIssueURL('');
    try {
      const result = await runGenerateArchitecture({ prd }, { apiKey: googleApiKey, model: selectedModel });
      setArchitecture(result.architecture);
      setSpecifications(result.specifications);

      // Automatically generate file structure after architecture/specs
      const fileStructResult = await runGenerateFileStructure(
        { prd, architecture: result.architecture, specifications: result.specifications },
        { apiKey: googleApiKey, model: selectedModel }
      );
      setFileStructure(fileStructResult.fileStructure || '');
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Architecture/File Structure Generation Failed',
        description: (error as Error).message,
      });
    } finally {
      setLoading((prev) => ({ ...prev, arch: false }));
    }
  };

  // REMOVED: handleGenerateFileStructure and all fileStruct loading logic, as file structure is now generated automatically after architecture/specs.

  const researchSingleTask = useCallback(async (task: Task) => {
    setTaskLoading(prev => ({ ...prev, [task.title]: true }));
    try {
      const result = await runResearchTask(
        { title: task.title, architecture, fileStructure, specifications },
        { apiKey: googleApiKey, model: selectedModel, useTDD }
      );
      const formattedDetails = `### Context\n${result.context}\n\n### Implementation Steps\n${result.implementationSteps}\n\n### Acceptance Criteria\n${result.acceptanceCriteria}`;
      setTasks(currentTasks =>
        currentTasks.map(t => t.title === task.title ? { ...t, details: formattedDetails } : t)
      );
      if (selectedTask?.title === task.title) {
        setEditedTaskDetails(formattedDetails);
      }
    } catch (researchError) {
      const errorMessage = `Failed to research task: ${(researchError as Error).message}`;
      setTasks(currentTasks =>
        currentTasks.map(t => t.title === task.title ? { ...t, details: errorMessage } : t)
      );
       if (selectedTask?.title === task.title) {
        setEditedTaskDetails(errorMessage);
      }
    } finally {
      setTaskLoading(prev => ({ ...prev, [task.title]: false }));
    }
  }, [architecture, fileStructure, specifications, googleApiKey, selectedModel, useTDD, selectedTask?.title]);


  const handleGenerateTasks = async () => {
    setLoading((prev) => ({ ...prev, tasks: true, researching: false }));
    setTasks([]);
    setFinalIssueURL('');
    setResearchProgress(0);

    try {
      const result = await runGenerateTasks(
        { architecture, specifications, fileStructure },
        { apiKey: googleApiKey, model: selectedModel, useTDD }
      );
      const initialTasks = result.tasks;

      if (!initialTasks || initialTasks.length === 0) {
        toast({
          title: 'No tasks generated',
          description: 'The AI could not generate a task list. Try adjusting the PRD or architecture.',
        });
        setLoading((prev) => ({ ...prev, tasks: false }));
        return;
      }
      
      const tasksWithPlaceholders = initialTasks.map((t) => ({ ...t, details: 'Researching...' }));
      setTasks(tasksWithPlaceholders);
      setLoading((prev) => ({ ...prev, tasks: false, researching: true }));
      
      for (let i = 0; i < initialTasks.length; i++) {
        await researchSingleTask(initialTasks[i]);
        setResearchProgress(((i + 1) / initialTasks.length) * 100);
      }
      
      toast({ title: 'Task research complete!', description: 'All tasks have been detailed.' });

    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Task Generation Failed',
        description: (error as Error).message,
      });
      setTasks([]);
    } finally {
      setLoading((prev) => ({ ...prev, tasks: false, researching: false }));
    }
  };


  const handleCreateIssue = async () => {
    setLoading((prev) => ({ ...prev, issue: true }));
    setFinalIssueURL('');
    try {
      if (!githubToken || !selectedRepo || tasks.length === 0 || selectedRepo === LOCAL_MODE_REPO_ID) {
        toast({
          variant: 'destructive',
          title: 'Cannot Create Issues',
          description: 'Please ensure you have selected a repository and generated tasks.',
        });
        setLoading((prev) => ({ ...prev, issue: false }));
        return;
      }
      
      const result = await createImplementationPlanIssues(
        githubToken,
        selectedRepo,
        prd,
        architecture,
        specifications,
        fileStructure,
        tasks
      );

      setFinalIssueURL(result.html_url);
      toast({
        title: 'GitHub Issues Created!',
        description: 'The implementation plan and sub-tasks are in your repository.',
        action: (
          <a href={result.html_url} target="_blank" rel="noopener noreferrer">
            <Button variant="outline">View Plan Issue</Button>
          </a>
        ),
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Issue Creation Failed',
        description: (error as Error).message,
      });
    } finally {
      setLoading((prev) => ({ ...prev, issue: false }));
    }
  };

  const handleExportData = async () => {
    if (tasks.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Nothing to Export',
        description: 'Please generate tasks first.',
      });
      return;
    }

    setLoading((prev) => ({ ...prev, exporting: true }));

    try {
      const zip = new JSZip();
      const docsFolder = zip.folder('docs');
      const tasksFolder = zip.folder('tasks');

      if (!docsFolder || !tasksFolder) {
        throw new Error('Could not create folders in zip file.');
      }

      // Add docs
      docsFolder.file('PRD.md', prd);
      docsFolder.file('ARCHITECTURE.md', architecture);
      docsFolder.file('SPECIFICATION.md', specifications);
      docsFolder.file('FILE_STRUCTURE.md', fileStructure);

      // Create main tasks file
      const mainTasksContent = tasks.map((task, index) => `- [ ] task-${(index + 1).toString().padStart(3, '0')}: ${task.title}`).join('\n');
      tasksFolder.file('tasks.md', `# Task List\n\n${mainTasksContent}`);

      // Create individual task files
      tasks.forEach((task, index) => {
        const taskNumber = (index + 1).toString().padStart(3, '0');
        tasksFolder.file(`task-${taskNumber}.md`, `# ${task.title}\n\n${task.details}`);
      });

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      saveAs(zipBlob, 'gitautomate-export.zip');

      toast({
        title: 'Export Successful',
        description: 'Your project data has been downloaded as a zip file.',
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Export Failed',
        description: 'There was an error creating the zip file.',
      });
      console.error('Export error:', error);
    } finally {
      setLoading((prev) => ({ ...prev, exporting: false }));
    }
  };
  
  const handleViewTask = (task: Task) => {
    setSelectedTask(task);
    setEditedTaskDetails(task.details);
    setIsTaskDetailOpen(true);
  };
  
  const handleSaveTaskDetails = () => {
    if (!selectedTask) return;
    const updatedTasks = tasks.map(task => 
      task.title === selectedTask.title 
        ? { ...task, details: editedTaskDetails } 
        : task
    );
    setTasks(updatedTasks);
    setIsTaskDetailOpen(false);
    setSelectedTask(null);
    toast({ title: "Task updated", description: "Your changes have been saved." });
  };
  
  const isResearchFailed = (details: string) => details.startsWith('Failed to research task');


  const cardAnimation = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.5, ease: 'easeOut' },
  };

  const LoadingSpinner = ({ text }: { text: string }) => (
    <div className="flex items-center justify-center gap-2 text-muted-foreground">
      <LoaderCircle className="h-5 w-5 animate-spin" />
      <span>{text}</span>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur-sm">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <Logo className="h-8 w-8 text-primary" />
            <h1 className="text-xl font-bold tracking-tight">GitAutomate</h1>
          </div>
          <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon">
                <Settings className="h-5 w-5" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Settings</DialogTitle>
                <DialogDescription>
                  Configure your API keys and select your preferred AI model. Your Google AI API Key from the .env file will be used if left blank here.
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(handleSaveSettings)}
                  className="space-y-4"
                >
                  <FormField
                    control={form.control}
                    name="githubToken"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>GitHub Token</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="ghp_... (optional)" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="googleApiKey"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Google AI API Key</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="AIza... (optional, overrides .env)" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="model"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>AI Model</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value} disabled={loading.models}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a model" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {loading.models && <SelectItem value="loading" disabled>Loading models...</SelectItem>}
                            {availableModels.map(model => (
                              <SelectItem key={model} value={model}>
                                {model}
                              </SelectItem>
                            ))}
                             {availableModels.length === 0 && !loading.models && <SelectItem value="none" disabled>No models found.</SelectItem>}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                   <FormField
                    control={form.control}
                    name="useTDD"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">
                            Use TDD
                          </FormLabel>
                          <FormDescription>
                           Generate tasks and implementation steps using Test-Driven Development.
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <DialogFooter>
                    <Button type="submit">Save Settings</Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <main className="container mx-auto p-4 md:p-8">
        <div className="mx-auto max-w-3xl space-y-8">
          <AnimatePresence>
            {/* Step 1: Configuration & Repo Selection */}
            <motion.div key="step1" {...cardAnimation}>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Github className="h-6 w-6 text-accent" />
                    <span>Step 1: Select Repository</span>
                  </CardTitle>
                  <CardDescription>
                    Choose a repository to create issues in, or use local mode to just export data.
                    {!githubToken && " You'll need to set your GitHub token to see your repos."}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loading.repos ? (
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-10 w-full" />
                    </div>
                  ) : (
                    <Select
                      value={selectedRepo}
                      onValueChange={setSelectedRepo}
                      disabled={repositories.length <= 1 && !githubToken}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a repository..." />
                      </SelectTrigger>
                      <SelectContent>
                        {repositories.map((repo) => (
                          <SelectItem key={repo.full_name} value={repo.full_name}>
                             <div className="flex items-center gap-2">
                              {repo.full_name === LOCAL_MODE_REPO_ID ? (
                                <ServerOff className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <Github className="h-4 w-4 text-muted-foreground" />
                              )}
                              <span>{repo.name}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {!githubToken && (
                     <Button onClick={() => setIsSettingsOpen(true)} className="w-full mt-4">
                       <KeyRound className="mr-2 h-4 w-4"/>
                        Configure GitHub Token to See Repositories
                      </Button>
                  )}
                </CardContent>
              </Card>
            </motion.div>
            
            {/* Step 2: PRD Input */}
            {selectedRepo && (
              <motion.div key="step2" {...cardAnimation}>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-6 w-6 text-accent" />
                      <span>Step 2: Provide PRD</span>
                    </CardTitle>
                    <CardDescription>
                      Paste your Product Requirements Document below. Before generating, ensure your Google AI API key is set in the settings or your environment.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Textarea
                      placeholder="As a user, I want to be able to..."
                      value={prd}
                      onChange={(e) => setPrd(e.target.value)}
                      rows={10}
                    />
                  </CardContent>
                  <CardFooter className="flex flex-col gap-2">
                    {/* NEW: Unified Project Generation Button */}
                    <Button
                      onClick={handleGenerateUnifiedProject}
                      disabled={!prd || loading.unified}
                      className="w-full"
                    >
                      {loading.unified ? (
                        <>
                          <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                          Generating Complete Project...
                        </>
                      ) : (
                        <>
                          🚀 Generate Complete Project <ChevronRight className="ml-2 h-4 w-4" />
                        </>
                      )}
                    </Button>
                    
                    {/* LEGACY: Old architecture button - kept for compatibility */}
                    <div className="text-xs text-muted-foreground mb-2">
                      Or use legacy workflow:
                    </div>
                    <Button
                      onClick={handleGenerateArchitecture}
                      disabled={!prd || loading.arch}
                      variant="outline"
                      className="w-full"
                    >
                      {loading.arch ? (
                        <>
                          <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          Generate Architecture <ChevronRight className="ml-2 h-4 w-4" />
                        </>
                      )}
                    </Button>
                  </CardFooter>
                </Card>
              </motion.div>
            )}

            {/* Step 3: Review Plan (Architecture, Specifications, File Structure in one card) */}
            {architecture && (
              <motion.div key="step3" {...cardAnimation}>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Wrench className="h-6 w-6 text-accent" />
                      <span>Step 3: Review Plan</span>
                    </CardTitle>
                    <CardDescription>
                      The AI has generated the following architecture, specifications, and file structure.
                      Review and edit if needed.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="architecture" className="text-lg font-semibold">Architecture</Label>
                      <Textarea
                        id="architecture"
                        value={architecture}
                        onChange={(e) => setArchitecture(e.target.value)}
                        rows={10}
                        className="mt-2 font-mono text-sm"
                      />
                    </div>
                    <div>
                      <Label htmlFor="specifications" className="text-lg font-semibold">Specifications</Label>
                      <Textarea
                        id="specifications"
                        value={specifications}
                        onChange={(e) => setSpecifications(e.target.value)}
                        rows={15}
                        className="mt-2 font-mono text-sm"
                      />
                    </div>
                    <div>
                      <Label htmlFor="file-structure" className="text-lg font-semibold">File Structure</Label>
                      <Textarea
                        id="file-structure"
                        value={fileStructure}
                        onChange={(e) => setFileStructure(e.target.value)}
                        rows={12}
                        className="mt-2 font-mono text-sm"
                      />
                    </div>
                  </CardContent>
                  <CardFooter className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={handleGenerateArchitecture}
                      disabled={loading.arch}
                    >
                      {loading.arch ? 'Regenerating...' : 'Regenerate'}
                    </Button>
                    {/* Show Generate Tasks button when using unified workflow and tasks haven't been generated yet */}
                    {architecture && useUnifiedWorkflow && !loading.unified && tasks.length === 0 && (
                      <Button onClick={handleGenerateTasksAfterApproval} disabled={loading.tasks || loading.researching}>
                        {loading.tasks || loading.researching ? (
                          <>
                            <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                            Generating...
                          </>
                        ) : (
                          <>
                            Generate Tasks <ChevronRight className="ml-2 h-4 w-4" />
                          </>
                        )}
                      </Button>
                    )}
                  </CardFooter>
                </Card>
              </motion.div>
            )}

            {loading.unified && (
               <motion.div key="loading-unified" {...cardAnimation}>
                   <LoadingSpinner text="Generating complete project with unified orchestrator..." />
               </motion.div>
            )}
            
            {loading.arch && (
               <motion.div key="loading-arch" {...cardAnimation}>
                   <LoadingSpinner text="Generating architecture & specs..." />
               </motion.div>
            )}

            {/* Unified Workflow Benefits */}
            {architecture && tasks.length > 0 && (
              <motion.div key="unified-benefits" {...cardAnimation}>
                <Card className="border-green-200 bg-green-50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-green-800">
                      <CheckCircle2 className="h-6 w-6" />
                      🎉 Unified Workflow Complete
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-green-700">
                    <div className="space-y-2 text-sm">
                      <p>✅ <strong>Architecture & Tasks Generated Together</strong></p>
                      <p>✅ <strong>Dependency Analysis Applied</strong> - Tasks know about their dependencies</p>
                      <p>✅ <strong>Cross-Component Validation</strong> - Architecture, file structure, and tasks are consistent</p>
                      <p>✅ <strong>Iterative Refinement</strong> - System automatically improves based on validation feedback</p>
                      <div className="mt-3 p-2 bg-white rounded border">
                        <p className="text-xs text-gray-600">🚀 This new unified workflow fixes the architectural flaws identified in Issue #7!</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Step 4: Task List */}
            {(tasks.length > 0 || loading.researching) && (
              <motion.div key="step4" {...cardAnimation}>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <ListChecks className="h-6 w-6 text-accent" />
                      <span>Step 4: Actionable Tasks</span>
                    </CardTitle>
                    <CardDescription>
                      {loading.researching
                        ? 'The AI is researching each task for detailed notes...'
                        : 'Click on a task to view, edit, and preview its details.'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {loading.researching && (
                      <div className="mb-4 space-y-2">
                        <Progress value={researchProgress} />
                        <p className="text-sm text-center text-muted-foreground">
                          {`Researching... (${Math.round((researchProgress / 100) * tasks.length)}/${tasks.length} complete)`}
                        </p>
                      </div>
                    )}
                    <div className="space-y-2">
                      {tasks.map((task, index) => (
                        <button
                          key={index}
                          onClick={() => handleViewTask(task)}
                          disabled={task.details === 'Researching...' || taskLoading[task.title]}
                          className="flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-muted/50 disabled:cursor-wait disabled:bg-muted/30"
                        >
                          {isResearchFailed(task.details) ? (
                            <AlertTriangle className="h-5 w-5 flex-shrink-0 text-destructive" />
                          ) : (
                            <Bot className="h-5 w-5 flex-shrink-0 text-primary" />
                          )}
                          <div className="flex-1 overflow-hidden">
                            <p className='font-medium truncate'>{task.title}</p>
                            {taskLoading[task.title] && (
                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                  <LoaderCircle className="h-3 w-3 animate-spin" />
                                  <span>Retrying research...</span>
                                </div>
                            )}
                            {task.details === 'Researching...' && !taskLoading[task.title] && (
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <LoaderCircle className="h-3 w-3 animate-spin" />
                                <span>Researching details...</span>
                              </div>
                            )}
                          </div>
                          <FilePenLine className="h-4 w-4 text-muted-foreground" />
                        </button>
                      ))}
                    </div>
                  </CardContent>
                  {/* Export/Issue buttons only shown after tasks are generated */}
                  {(tasks.length > 0) && (
                    <CardFooter className="flex justify-end gap-2">
                       <Button
                        variant="outline"
                        onClick={handleExportData}
                        disabled={loading.exporting || loading.researching}
                      >
                        {loading.exporting ? (
                          <>
                            <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                            Exporting...
                          </>
                        ) : (
                          <>
                            <Download className="mr-2 h-4 w-4" />
                            Export Data
                          </>
                        )}
                      </Button>
                      <Button
                        onClick={handleCreateIssue}
                        disabled={loading.issue || loading.researching || selectedRepo === LOCAL_MODE_REPO_ID}
                        title={selectedRepo === LOCAL_MODE_REPO_ID ? "Cannot create issues in local mode" : ""}
                      >
                        {loading.issue ? (
                          <>
                            <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                            Creating Issue...
                          </>
                        ) : (
                          <>
                             <Github className="mr-2 h-4 w-4"/> Create GitHub Issue
                          </>
                        )}
                      </Button>
                    </CardFooter>
                  )}
                </Card>
              </motion.div>
            )}
            {loading.tasks && !loading.researching && (
                <motion.div key="loading-tasks" {...cardAnimation}>
                    <LoadingSpinner text="Generating task list..." />
                </motion.div>
            )}

            {/* Step 5: Done */}
            {finalIssueURL && (
               <motion.div key="step5" {...cardAnimation}>
                  <Card className="bg-gradient-to-br from-primary/20 to-background">
                     <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                           <CheckCircle2 className="h-6 w-6 text-green-500" />
                           <span>All Done!</span>
                        </CardTitle>
                        <CardDescription>
                           Your implementation plan has been created as a GitHub Issue.
                        </CardDescription>
                     </CardHeader>
                     <CardContent>
                        <a href={finalIssueURL} target="_blank" rel="noopener noreferrer">
                           <Button className="w-full">
                              <ExternalLink className="mr-2 h-4 w-4"/>
                              View Created Issue
                           </Button>
                        </a>
                     </CardContent>
                     <CardFooter>
                        <Button variant="link" onClick={() => {
                           setSelectedRepo(LOCAL_MODE_REPO_ID);
                           setPrd('');
                           setArchitecture('');
                           setSpecifications('');
                           setTasks([]);
                           setFinalIssueURL('');
                           setSelectedTask(null);
                        }}>Start Over</Button>
                     </CardFooter>
                  </Card>
               </motion.div>
            )}
             {loading.issue && (
                <motion.div key="loading-issue" {...cardAnimation}>
                    <LoadingSpinner text="Creating GitHub Issue..." />
                </motion.div>
            )}

          </AnimatePresence>
        </div>
      </main>
      
      <Dialog open={isTaskDetailOpen} onOpenChange={setIsTaskDetailOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{selectedTask?.title}</DialogTitle>
            <DialogDescription>
              Review and edit the details for this task. This will be included in the GitHub issue.
            </DialogDescription>
          </DialogHeader>
          <div className="grid md:grid-cols-2 gap-6 overflow-y-auto pr-4">
            <div className="space-y-2">
              <Label htmlFor="task-details" className="font-semibold">
                Task Details & Research
              </Label>
              <Textarea
                id="task-details"
                value={editedTaskDetails}
                onChange={(e) => setEditedTaskDetails(e.target.value)}
                rows={20}
                className="text-sm"
              />
            </div>
            <div className="space-y-2">
                <Label className="font-semibold">GitHub Issue Preview</Label>
                <div className="space-y-2 rounded-md border bg-muted/50 p-4 h-full overflow-y-auto">
                    <h4 className="font-bold text-card-foreground">✅ {selectedTask?.title}</h4>
                    <Separator/>
                    {isResearchFailed(editedTaskDetails) ? (
                      <div className="text-destructive-foreground bg-destructive/80 p-3 rounded-md">
                        <p className="font-bold">Research Failed</p>
                        <p className="text-sm">{editedTaskDetails}</p>
                      </div>
                    ) : (
                      <div 
                        className="text-sm text-muted-foreground prose prose-sm dark:prose-invert max-w-none" 
                        dangerouslySetInnerHTML={{ __html: editedTaskDetails.replace(/\n/g, '<br />') }}
                      />
                    )}
                </div>
            </div>
          </div>
          <DialogFooter className="mt-auto pt-4">
            {selectedTask && isResearchFailed(selectedTask.details) && (
              <Button
                variant="destructive"
                onClick={() => researchSingleTask(selectedTask)}
                disabled={taskLoading[selectedTask.title]}
                className="mr-auto"
              >
                {taskLoading[selectedTask.title] ? (
                  <>
                    <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                    Retrying...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Retry Research
                  </>
                )}
              </Button>
            )}
            <Button variant="outline" onClick={() => setIsTaskDetailOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveTaskDetails}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
