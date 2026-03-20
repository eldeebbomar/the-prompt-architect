import { useParams } from "react-router-dom";

const ProjectDetail = () => {
  const { id } = useParams();
  return (
    <div className="container py-16">
      <h1 className="font-heading text-3xl text-foreground">Project {id}</h1>
    </div>
  );
};

export default ProjectDetail;
